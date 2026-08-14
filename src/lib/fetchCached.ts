/**
 * Build-time fetch with a disk fallback.
 *
 * Every remote this site builds against — the GitHub stats API, the LeetCode
 * stats API, the blog API, the analytics API — goes down or rate-limits
 * periodically. Without a fallback a single 500 during a deploy ships a page
 * with an empty projects grid or a zeroed contribution graph, and the only
 * signal is a line in the build log.
 *
 * So: every successful payload is mirrored to `.cache/<namespace>/<key>.json`
 * and replayed when the live call fails. A build degrades to the last known
 * good data instead of to nothing.
 *
 * `.cache/` is gitignored and best-effort throughout — a read-only filesystem
 * (or a cold CI runner with no cache restored) makes this a plain fetch, never
 * an error.
 *
 * NODE ONLY. This touches `node:fs`, so it must not be reachable from a client
 * bundle — import it only from modules that are pulled into Astro frontmatter.
 *
 * `src/data/` holds two kinds of module and the difference matters when a build
 * breaks:
 *
 *   - Authored content (`profile`, `experiences`, `resume`, `downloads`, `docs/`)
 *     is local and cannot fail.
 *   - Remote sources (`github`, `leetcode`, `blog`, `projects`, `starLists`,
 *     `analyticsProjects`) do network I/O at build time and every one of them
 *     should route through this module, so an upstream outage costs freshness
 *     rather than content.
 */

import fs from "node:fs";
import path from "node:path";

const CACHE_ROOT = path.join(process.cwd(), ".cache");

/** Status codes worth a second attempt: rate limits and transient gateway faults. */
const RETRY_STATUSES = new Set([429, 502, 503, 504]);

/**
 * Backoff schedule, in milliseconds. Deliberately short and finite — a deploy
 * should not hang for minutes because an upstream is down, and the disk cache
 * is already a better answer than a long wait.
 */
const RETRY_DELAYS = [300, 900];

function cacheFile(namespace: string, key: string): string {
	// Keys reach the filesystem, so flatten anything path-like in them.
	const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, "-");
	return path.join(CACHE_ROOT, namespace, `${safeKey}.json`);
}

export function readCache<T>(namespace: string, key: string): T | null {
	try {
		const file = cacheFile(namespace, key);
		if (!fs.existsSync(file)) return null;
		return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
	} catch {
		return null;
	}
}

export function writeCache(namespace: string, key: string, data: unknown): void {
	try {
		const file = cacheFile(namespace, key);
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, JSON.stringify(data), "utf-8");
	} catch {
		/* cache is best-effort */
	}
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch, retrying only the statuses that a retry can actually fix.
 *
 * A 404 or a 401 is returned as-is: retrying it wastes build time and the
 * caller wants to fall through to the cache immediately.
 */
async function fetchWithRetry(
	url: string,
	init?: RequestInit,
): Promise<Response | null> {
	let lastError: unknown = null;

	for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
		if (attempt > 0) await sleep(RETRY_DELAYS[attempt - 1]);

		try {
			const res = await fetch(url, init);
			if (res.ok || !RETRY_STATUSES.has(res.status)) return res;
			lastError = `HTTP ${res.status}`;
		} catch (e) {
			lastError = e;
		}
	}

	console.error(`Fetch failed after retries for ${url}:`, lastError);
	return null;
}

/**
 * A namespaced cache-backed fetcher.
 *
 * The namespace is the `.cache/` subdirectory, so each data module owns its
 * own key space and two modules cannot collide on a generic key like "stats".
 */
export function createCachedFetch(namespace: string) {
	/**
	 * Fetch JSON, falling back to the last cached payload.
	 *
	 * Returns `null` only when the request failed *and* nothing was cached, so
	 * callers can tell "upstream is down, here is stale data" from "we have
	 * never seen this succeed".
	 */
	async function fetchJson<T>(
		url: string,
		key: string,
		init?: RequestInit,
	): Promise<T | null> {
		const res = await fetchWithRetry(url, init);

		if (res?.ok) {
			try {
				const data = (await res.json()) as T;
				// Only mirror what parsed — caching a truncated body would replay
				// the failure on every subsequent build.
				writeCache(namespace, key, data);
				return data;
			} catch (e) {
				console.error(`Invalid JSON from ${url}:`, e);
			}
		} else if (res) {
			console.error(`Fetch failed (${res.status}) for ${url}`);
		}

		const cached = readCache<T>(namespace, key);
		if (cached) console.warn(`Using cached payload for ${namespace}/${key}`);
		return cached;
	}

	/** As `fetchJson`, for endpoints that answer with text (SVG badges, raw files). */
	async function fetchText(
		url: string,
		key: string,
		init?: RequestInit,
	): Promise<string | null> {
		const res = await fetchWithRetry(url, init);

		if (res?.ok) {
			try {
				const text = await res.text();
				writeCache(namespace, key, text);
				return text;
			} catch (e) {
				console.error(`Failed reading body from ${url}:`, e);
			}
		} else if (res) {
			console.error(`Fetch failed (${res.status}) for ${url}`);
		}

		const cached = readCache<string>(namespace, key);
		if (cached !== null) console.warn(`Using cached payload for ${namespace}/${key}`);
		return cached;
	}

	return { fetchJson, fetchText };
}
