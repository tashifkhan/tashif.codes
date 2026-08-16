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
	const d = new Date(date);
	if (Number.isNaN(d.getTime())) return "";
	return d.toUTCString();
};
