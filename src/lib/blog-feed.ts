/**
 * Shared builder for the blog RSS feed.
 *
 * `src/pages/rss.xml.ts` is the canonical URL; `src/pages/feed.xml.ts` and
 * `src/pages/blog/rss.xml.ts` are thin aliases that call {@link buildBlogFeedXml}
 * with their own path so each feed's atom self-link points at itself.
 */

import {
	BLOG_REPO_URL,
	BLOG_SITE_ORIGIN,
	blogPosts,
	fetchAllPostsFull,
	resolveCoverImage,
} from "@/data/blog";
import { cdata, escapeXml, rfc822, rfc822Now, sanitizeRssHtml } from "@/lib/rss";
import { renderMarkdown } from "@/components/common/markdown/pipeline/render";

const SITE = "https://tashif.codes";
export const BLOG_FEED_PATH = "/rss.xml";
const FEED_TITLE = "Blog — Tashif Ahmad Khan";
const FEED_DESCRIPTION =
	"Posts from Tashif Ahmad Khan on web development, programming, and technology.";

/** Guess a MIME type for an <enclosure> from its URL. */
const mimeForEnclosure = (url: string): string | null => {
	const path = url.split("?")[0]?.toLowerCase() ?? "";
	if (path.endsWith(".png")) return "image/png";
	if (path.endsWith(".webp")) return "image/webp";
	if (path.endsWith(".gif")) return "image/gif";
	if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
	// SVG and unknown types: readers expect raster enclosures, so the caller
	// falls back to the pre-rendered OG JPEG instead.
	return null;
};

/**
 * Cover image for an <enclosure>.
 *
 * Prefers the post's own cover when it is a raster image; otherwise uses the
 * pre-rendered OG card (`/og/blog/<slug>.jpg`, built by `scripts/generate-og.mjs`)
 * — the same image link unfurls show.
 */
const enclosureUrlFor = (
	post: { slug: string; coverImage?: string; metadata?: Record<string, unknown> },
): string => {
	const cover = resolveCoverImage(post);
	if (cover && mimeForEnclosure(cover)) return cover;
	return `${SITE}/og/blog/${encodeURIComponent(post.slug)}.jpg`;
};

const stripHtml = (html: string): string =>
	html
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();

/**
 * Render one post's markdown to reader-safe HTML.
 *
 * Uses the same renderer as `blog/[slug].astro` so custom blocks (`<Lede>`,
 * `<Toc>`, callouts, …) become plain HTML instead of leaking raw tags into
 * the feed. RSS differences from the page render, all deliberate:
 *
 * - `mermaid: false` — diagrams degrade to readable code blocks instead of
 *   JS-hydrated placeholders that never hydrate in a reader.
 * - Empty theme — structural `md-*` classes only, no Tailwind site skin.
 * - `assetBaseUrl` — root-relative `/images/blog/…` becomes absolute so
 *   images load outside tashif.codes.
 * - {@link sanitizeRssHtml} — fragment links absolutized, scripts/buttons
 *   stripped, iframe fallback links added.
 */
export const renderPostHtmlForFeed = async (
	markdown: string,
	postUrl: string,
): Promise<string> => {
	const html = await renderMarkdown(markdown, {
		githubBaseUrl: BLOG_REPO_URL,
		githubProfileUrl: "https://github.com/tashifkhan",
		rootRelative: "site",
		assetBaseUrl: BLOG_SITE_ORIGIN,
		siteBaseUrl: SITE,
		blogBaseUrl: BLOG_SITE_ORIGIN,
		mermaid: false,
		theme: {},
	});
	return sanitizeRssHtml(html, postUrl);
};

export const buildBlogFeedXml = async (
	selfPath: string = BLOG_FEED_PATH,
): Promise<string> => {
	let markdownBySlug = new Map<string, string>();
	try {
		const full = await fetchAllPostsFull();
		markdownBySlug = new Map(full.map((post) => [post.slug, post.markdown]));
	} catch (err) {
		console.error("Error fetching full posts for RSS:", err);
	}

	const items = await Promise.all(
		blogPosts
			.filter((post) => post.title)
			.map(async (post) => {
				const url = `${SITE}/blog/${post.slug}`;
				const categories = (Array.isArray(post.tags) ? post.tags : [])
					.map((tag) => `\n\t\t<category>${escapeXml(tag)}</category>`)
					.join("");

				const markdown = markdownBySlug.get(post.slug);
				const fullHtml = markdown
					? await renderPostHtmlForFeed(markdown, url).catch((err) => {
							console.error(`Error rendering "${post.slug}" for RSS:`, err);
							return "";
						})
					: "";

				// description: short excerpt as plain text (what readers list);
				// content:encoded: the full article HTML (what readers open).
				const excerptText = (post.excerpt ?? "").trim();
				const description = excerptText
					? `<description>${escapeXml(excerptText)}</description>`
					: fullHtml
						? `<description>${escapeXml(stripHtml(fullHtml).slice(0, 500))}</description>`
						: "";
				const content = fullHtml
					? `\n\t\t<content:encoded>${cdata(fullHtml)}</content:encoded>`
					: excerptText
						? `\n\t\t<content:encoded>${cdata(`<p>${escapeXml(excerptText)}</p>`)}</content:encoded>`
						: "";

				const pubDate = rfc822(post.date);
				const pubDateTag = pubDate ? `\n\t\t<pubDate>${pubDate}</pubDate>` : "";
				const authorName = post.author || "Tashif Ahmad Khan";
				const enclosureUrl = enclosureUrlFor(post);
				const enclosure =
					`\n\t\t<enclosure url="${escapeXml(enclosureUrl)}" type="${mimeForEnclosure(enclosureUrl) ?? "image/jpeg"}" length="0" />`;

				return `\t<item>
\t\t<title>${escapeXml(post.title)}</title>
\t\t<link>${escapeXml(url)}</link>
\t\t<guid isPermaLink="true">${escapeXml(url)}</guid>${pubDateTag}${categories}
\t\t<dc:creator>${escapeXml(authorName)}</dc:creator>${enclosure}
\t\t${description}${content}
\t</item>`;
			}),
	);

	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
\t<title>${escapeXml(FEED_TITLE)}</title>
\t<link>${SITE}/blog</link>
\t<description>${escapeXml(FEED_DESCRIPTION)}</description>
\t<language>en-us</language>
\t<lastBuildDate>${rfc822Now()}</lastBuildDate>
\t	<atom:link href="${SITE}${selfPath}" rel="self" type="application/rss+xml" />
\t<generator>tashif.codes RSS (Astro)</generator>
\t<docs>https://www.rssboard.org/rss-specification</docs>
\t<ttl>60</ttl>
${items.join("\n")}
</channel>
</rss>`;
};

/** Response headers shared by the canonical feed and its aliases. */
export const blogFeedHeaders = (): HeadersInit => ({
	"Content-Type": "application/rss+xml; charset=utf-8",
	"Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate",
});
