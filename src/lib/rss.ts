/** Shared helpers for building RSS 2.0 feeds (see src/pages/rss*.xml.ts). */

export const escapeXml = (value: string): string =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");

/** Wrap raw markdown/HTML content so it survives XML parsing untouched. */
export const cdata = (value: string): string =>
	`<![CDATA[${value.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

/** Date → RFC 822 (the RSS pubDate format), UTC. Empty string when invalid. */
export const rfc822 = (date?: string | Date | null): string => {
	if (!date) return "";
	const d = date instanceof Date ? date : new Date(date);
	if (Number.isNaN(d.getTime())) return "";
	return d.toUTCString();
};

/** RFC 822 timestamp for "now" — never empty (for lastBuildDate). */
export const rfc822Now = (): string => new Date().toUTCString();

/**
 * Make RSS HTML self-contained for readers outside the site.
 *
 * The shared markdown renderer emits site-relative affordances that make
 * sense in the browser but break in Feedly / NetNewsWire / Inoreader:
 *
 * - `href="#slug"` (TOC entries, heading permalinks) has no page to resolve
 *   against, so point it at the post URL.
 * - `<script>` and copy-button chrome (`md-code-copy`, `data-code`) are
 *   interactive site UI — strip them; the code text stays.
 * - `data-haptic*` attributes are app wiring — strip them.
 * - `<iframe>` embeds (YouTube etc.) are dropped by most readers, so append
 *   a plain link fallback after each one.
 */
export const sanitizeRssHtml = (html: string, postUrl: string): string => {
	if (!html) return "";
	let out = html;

	// Scripts never belong in a feed.
	out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "");

	// Code copy buttons carry the whole block base64-ish in data-code — bloat
	// with zero value in a reader. The <pre><code> that follows stays.
	out = out.replace(
		/<button\b[^>]*\bmd-code-copy\b[^>]*>[\s\S]*?<\/button\s*>/gi,
		"",
	);
	// Any other button (tabs UI etc.) — drop the chrome, keep surrounding text.
	out = out.replace(/<button\b[^>]*>[\s\S]*?<\/button\s*>/gi, "");

	// App wiring attributes.
	out = out
		.replace(/\sdata-haptic(?:-[a-z-]+)?(?:="[^"]*")?/gi, "")
		.replace(/\sdata-code="[^"]*"/gi, "");

	// TOC + heading permalinks: "#slug" → "https://tashif.codes/blog/x#slug".
	out = out.replace(
		/\shref="#([^"]*)"/gi,
		(_, frag: string) => ` href="${postUrl}#${frag}"`,
	);

	// Iframe fallback: readers strip frames, so leave a link behind.
	out = out.replace(
		/<iframe\b[^>]*\bsrc="([^"]+)"[^>]*>(?:[\s\S]*?<\/iframe\s*>|\/>)/gi,
		(_, src: string) =>
			`<p><a href="${src}">View embedded content</a></p>`,
	);

	return out.trim();
};
