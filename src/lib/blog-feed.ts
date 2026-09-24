/**
 * Shared builder for the blog RSS feed.
 *
 * `src/pages/rss.xml.ts` is the canonical URL; `src/pages/feed.xml.ts` and
 * `src/pages/blog/rss.xml.ts` are thin aliases that call {@link buildBlogFeedXml}
 * with their own path so each feed's atom self-link points at itself.
 */

import { stat } from "node:fs/promises";
import { join } from "node:path";
import {
	BLOG_REPO_URL,
	BLOG_SITE_ORIGIN,
	blogPosts,
	fetchAllPostsFull,
	resolveCoverImage,
} from "@/data/blog";
import {
	SITE,
	buildChannel,
	cdata,
	escapeXml,
	htmlToText,
	rfc822,
	sanitizeRssHtml,
} from "@/lib/rss";
import { renderMarkdown } from "@/components/common/markdown/pipeline/render";

export const BLOG_FEED_PATH = "/rss.xml";
const FEED_TITLE = "Blog — Tashif Ahmad Khan";
const FEED_DESCRIPTION =
	"Posts from Tashif Ahmad Khan on web development, programming, and technology.";

/**
 * Byte budget for all items together. Each item holds the full article HTML
 * (20–60 KB per post), and some readers truncate or reject feeds past
 * ~512 KB, so the feed carries the newest posts that fit, leaving headroom
 * for the channel header. Older posts stay reachable from /blog.
 */
const FEED_ITEMS_BYTE_BUDGET = 450_000;

/** Guess a MIME type for an image from its URL. */
const mimeForImage = (url: string): string | null => {
	const path = url.split("?")[0]?.toLowerCase() ?? "";
	if (path.endsWith(".png")) return "image/png";
	if (path.endsWith(".webp")) return "image/webp";
	if (path.endsWith(".gif")) return "image/gif";
	if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
	// SVG and unknown types: readers expect raster images, so the caller
	// falls back to the pre-rendered OG JPEG instead.
	return null;
};

type CoverImage = { url: string; type: string; length: number | null };

/**
 * Cover image for the item's <enclosure> and <media:*> tags.
 *
 * Prefers the post's own cover when it is a raster image; otherwise uses the
 * pre-rendered OG card (`/og/blog/<slug>.jpg`, built by `scripts/generate-og.mjs`
 * in `prebuild`), the same image link unfurls show.
 *
 * RSS 2.0 requires the enclosure's byte length. The OG card is on disk, so
 * stat it; a remote cover gets a HEAD request. `length` is null when neither
 * works, and the caller then skips <enclosure> and keeps only <media:*>.
 */
const coverImageFor = async (post: {
	slug: string;
	coverImage?: string;
	metadata?: Record<string, unknown>;
}): Promise<CoverImage> => {
	const cover = resolveCoverImage(post);
	const coverType = cover ? mimeForImage(cover) : null;
	if (cover && coverType) {
		try {
			const res = await fetch(cover, { method: "HEAD" });
			const length = Number(res.headers.get("content-length"));
			return {
				url: cover,
				type: coverType,
				length: res.ok && length > 0 ? length : null,
			};
		} catch {
			return { url: cover, type: coverType, length: null };
		}
	}

	const url = `${SITE}/og/blog/${encodeURIComponent(post.slug)}.jpg`;
	try {
		const file = await stat(
			join(process.cwd(), "public", "og", "blog", `${post.slug}.jpg`),
		);
		return { url, type: "image/jpeg", length: file.size };
	} catch {
		return { url, type: "image/jpeg", length: null };
	}
};

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

/** One post as an RSS <item>. */
const buildItem = async (
	post: (typeof blogPosts)[number],
	markdown: string | undefined,
): Promise<string> => {
	const url = `${SITE}/blog/${post.slug}`;
	const categories = (Array.isArray(post.tags) ? post.tags : [])
		.map((tag) => `\n\t\t<category>${escapeXml(tag)}</category>`)
		.join("");

	const fullHtml = markdown
		? await renderPostHtmlForFeed(markdown, url).catch((err) => {
				console.error(`Error rendering "${post.slug}" for RSS:`, err);
				return "";
			})
		: "";

	// description: short excerpt as plain text (what readers list);
	// content:encoded: the full article HTML (what readers open).
	const excerptText = (post.excerpt ?? "").trim();
	const descriptionText = excerptText || htmlToText(fullHtml).slice(0, 500);
	const description = descriptionText
		? `\n\t\t<description>${escapeXml(descriptionText)}</description>`
		: "";
	const contentHtml =
		fullHtml || (excerptText ? `<p>${escapeXml(excerptText)}</p>` : "");
	const content = contentHtml
		? `\n\t\t<content:encoded>${cdata(contentHtml)}</content:encoded>`
		: "";

	const pubDate = rfc822(post.date);
	const pubDateTag = pubDate ? `\n\t\t<pubDate>${pubDate}</pubDate>` : "";
	const authorName = post.author || "Tashif Ahmad Khan";

	const cover = await coverImageFor(post);
	const coverUrl = escapeXml(cover.url);
	const enclosure =
		cover.length !== null
			? `\n\t\t<enclosure url="${coverUrl}" type="${cover.type}" length="${cover.length}" />`
			: "";
	// Feedly, Inoreader and NetNewsWire pick card images from media:*.
	const media =
		`\n\t\t<media:thumbnail url="${coverUrl}" />` +
		`\n\t\t<media:content url="${coverUrl}" medium="image" type="${cover.type}" />`;

	return `\t<item>
\t\t<title>${escapeXml(post.title)}</title>
\t\t<link>${escapeXml(url)}</link>
\t\t<guid isPermaLink="true">${escapeXml(url)}</guid>${pubDateTag}${categories}
\t\t<dc:creator>${escapeXml(authorName)}</dc:creator>${enclosure}${media}${description}${content}
\t</item>`;
};

/**
 * Items are the same for the canonical feed and both aliases, so build them
 * once per build instead of re-fetching and re-rendering for every route.
 */
let itemsPromise: Promise<string[]> | undefined;

const buildItems = async (): Promise<string[]> => {
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
			.map((post) => buildItem(post, markdownBySlug.get(post.slug))),
	);

	// Newest first until the budget runs out; always keep the newest post.
	const encoder = new TextEncoder();
	let used = 0;
	return items.filter((item, index) => {
		used += encoder.encode(item).length + 1;
		return index === 0 || used <= FEED_ITEMS_BYTE_BUDGET;
	});
};

export const buildBlogFeedXml = async (
	selfPath: string = BLOG_FEED_PATH,
): Promise<string> => {
	itemsPromise ??= buildItems();
	return buildChannel({
		title: FEED_TITLE,
		link: `${SITE}/blog`,
		description: FEED_DESCRIPTION,
		selfPath,
		items: await itemsPromise,
	});
};
