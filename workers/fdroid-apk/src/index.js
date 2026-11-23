/**
 * Serve F-Droid APKs from R2 at:
 *   /fdroid/repo/<apkName>.apk  ->  repo/<apkName>.apk
 *   /fdroid/<alias>.apk         ->  <alias>.apk
 *
 * Official F-Droid clients require HTTP 200 of the exact bytes (no 302s)
 * and may use Range requests on large APKs.
 */

const APK_TYPE = "application/vnd.android.package-archive";
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const NAME_RE = /^[A-Za-z0-9._+-]+$/;
const REPO_PATH = /^\/fdroid\/repo\/([^/]+)\.apk$/;
const ALIAS_PATH = /^\/fdroid\/([^/]+)\.apk$/;

/**
 * @param {string} pathname
 * @returns {string | null}
 */
function objectKey(pathname) {
  let path;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (path.includes("\0") || path.includes("..") || path.includes("\\")) {
    return null;
  }

  let match = path.match(REPO_PATH);
  if (match) {
    const name = match[1];
    if (!NAME_RE.test(name)) return null;
    return `repo/${name}.apk`;
  }

  match = path.match(ALIAS_PATH);
  if (match) {
    const name = match[1];
    if (name === "repo" || !NAME_RE.test(name)) return null;
    return `${name}.apk`;
  }

  return null;
}

/**
 * @param {string | null} header
 * @param {number} size
 * @returns {{ offset: number, length: number, start: number, end: number } | "unsatisfiable" | null}
 */
function parseRange(header, size) {
  if (!header) return null;
  const trimmed = header.trim();
  // Only a single bytes range. Multi-range: ignore and serve full body.
  const m = /^bytes=(\d*)-(\d*)$/i.exec(trimmed);
  if (!m) return null;
  const startTok = m[1];
  const endTok = m[2];
  if (startTok === "" && endTok === "") return "unsatisfiable";

  let start;
  let end;
  if (startTok === "") {
    // suffix: bytes=-N
    const suffix = Number(endTok);
    if (!Number.isInteger(suffix) || suffix <= 0) return "unsatisfiable";
    if (suffix >= size) {
      start = 0;
      end = size - 1;
    } else {
      start = size - suffix;
      end = size - 1;
    }
  } else {
    start = Number(startTok);
    end = endTok === "" ? size - 1 : Number(endTok);
    if (!Number.isInteger(start) || !Number.isInteger(end)) return "unsatisfiable";
    if (start >= size || start < 0) return "unsatisfiable";
    if (end >= size) end = size - 1;
    if (end < start) return "unsatisfiable";
  }

  return { offset: start, length: end - start + 1, start, end };
}

/**
 * @param {R2Object | R2ObjectBody} object
 * @param {number} [contentLength]
 */
function baseHeaders(object, contentLength) {
  const headers = new Headers();
  headers.set("Content-Type", APK_TYPE);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", CACHE_CONTROL);
  headers.set("X-Content-Type-Options", "nosniff");
  const etag = object.httpEtag || (object.etag ? `"${object.etag}"` : "");
  if (etag) headers.set("ETag", etag);
  if (object.uploaded) {
    headers.set("Last-Modified", object.uploaded.toUTCString());
  }
  if (contentLength !== undefined) {
    headers.set("Content-Length", String(contentLength));
  }
  return headers;
}

export default {
  /**
   * @param {Request} request
   * @param {{ FDROID_BUCKET: R2Bucket }} env
   */
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }

    const url = new URL(request.url);
    const key = objectKey(url.pathname);
    if (!key) {
      // CF Worker routes only allow a trailing path wildcard, so the
      // production route is tashif.codes/fdroid/* (indexes, listing pages,
      // and APKs). Non-APK paths must go to the Vercel origin. Do not
      // fetch tashif.codes itself — that would loop through this Worker.
      if (shouldPassToOrigin(url.hostname)) {
        return passToOrigin(request, env, url);
      }
      return new Response("Not Found", { status: 404 });
    }

    const head = await env.FDROID_BUCKET.head(key);
    if (head === null) {
      return new Response("Not Found", { status: 404 });
    }

    const size = head.size;
    const etag = head.httpEtag || (head.etag ? `"${head.etag}"` : "");
    const ifNoneMatch = request.headers.get("If-None-Match");
    if (ifNoneMatch && etag && etagMatches(ifNoneMatch, etag)) {
      const headers = baseHeaders(head, undefined);
      headers.delete("Content-Length");
      return new Response(null, { status: 304, headers });
    }

    const rangeHeader = request.headers.get("Range");
    const ifRange = request.headers.get("If-Range");
    let range = parseRange(rangeHeader, size);
    if (range && ifRange && !ifRangeSatisfied(ifRange, head, etag)) {
      range = null;
    }

    if (range === "unsatisfiable") {
      const headers = baseHeaders(head, 0);
      headers.set("Content-Range", `bytes */${size}`);
      headers.set("Content-Length", "0");
      return new Response(null, { status: 416, headers });
    }

    if (request.method === "HEAD") {
      if (range) {
        const headers = baseHeaders(head, range.length);
        headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
        return new Response(null, { status: 206, headers });
      }
      const headers = baseHeaders(head, size);
      return new Response(null, { status: 200, headers });
    }

    if (range) {
      const object = await env.FDROID_BUCKET.get(key, {
        range: { offset: range.offset, length: range.length },
      });
      if (object === null) {
        return new Response("Not Found", { status: 404 });
      }
      const headers = baseHeaders(object, range.length);
      headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
      return new Response(object.body, { status: 206, headers });
    }

    const object = await env.FDROID_BUCKET.get(key);
    if (object === null) {
      return new Response("Not Found", { status: 404 });
    }
    const headers = baseHeaders(object, size);
    return new Response(object.body, { status: 200, headers });
  },
};

/**
 * @param {string} ifNoneMatch
 * @param {string} etag
 */
function etagMatches(ifNoneMatch, etag) {
  if (ifNoneMatch.trim() === "*") return true;
  return ifNoneMatch
    .split(",")
    .map((part) => part.trim())
    .some((part) => part === etag || part === `W/${etag}`);
}

/**
 * @param {string} ifRange
 * @param {R2Object} object
 * @param {string} etag
 */
function ifRangeSatisfied(ifRange, object, etag) {
  const value = ifRange.trim();
  if (value.startsWith('"') || value.startsWith("W/")) {
    return value === etag || value === `W/${etag}`;
  }
  const since = Date.parse(value);
  if (Number.isNaN(since) || !object.uploaded) return false;
  return object.uploaded.getTime() <= since;
}

/**
 * @param {string} hostname
 */
function shouldPassToOrigin(hostname) {
  const host = hostname.toLowerCase();
  return host === "tashif.codes" || host === "www.tashif.codes";
}

/**
 * @param {Request} request
 * @param {{ ORIGIN_HOST?: string }} env
 * @param {URL} url
 */
function passToOrigin(request, env, url) {
  const originHost = env.ORIGIN_HOST;
  if (!originHost) {
    return new Response("Not Found", { status: 404 });
  }
  const origin = new URL(url.toString());
  origin.hostname = originHost;
  origin.protocol = "https:";
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("cf-connecting-ip");
  headers.delete("cf-ray");
  headers.delete("cf-visitor");
  headers.delete("cf-ew-via");
  headers.delete("cdn-loop");
  // Avoid a 307/308 from a vercel.app alias back to tashif.codes (loop).
  return fetch(
    new Request(origin.toString(), {
      method: request.method,
      headers,
      redirect: "manual",
    }),
  );
}
