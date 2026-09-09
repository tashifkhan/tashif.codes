/**
 * Open Graph / Twitter Card helpers for link previews across messengers.
 *
 * Used by: WhatsApp, Telegram, iMessage, Signal, X/Twitter, Discord, Slack,
 * LinkedIn, Facebook. Crawlers read <head> meta — not the visible <img>.
 *
 * Prefer absolute HTTPS raster URLs (PNG/JPEG/WebP). SVG is ignored by nearly
 * every unfurl bot. Declare og:image:width/height so WhatsApp/iMessage can
 * paint the card on the first share without waiting on an async probe.
 */

import { owner } from "../data/profile";

export const SITE_ORIGIN = "https://tashif.codes";
export const SITE_NAME = "tashif.codes";
export const DEFAULT_DESCRIPTION =
	"Personal dashboard, blog, projects, and developer tools by Tashif Ahmad Khan.";
/** Branded fallback when a page has no raster cover (committed under public/). */
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og/default.jpg`;

/** Canonical large-card size (1.91:1) — WhatsApp / Telegram / iMessage / X. */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

const RASTER_EXT = /\.(png|jpe?g|webp|gif)(?:$|\?)/i;
const SVG_EXT = /\.svg(?:$|\?)/i;

export type SeoProps = {
	title: string;
	description?: string;
	/** Absolute or site-relative image URL for og:image / twitter:image */
	image?: string | null;
	/** Canonical page URL (absolute or path) */
	url?: string;
	type?: "website" | "article";
	/** ISO date for article:published_time */
	publishedTime?: string;
	/** Comma-ish tags / article:tag */
	tags?: string[];
};

export type SocialImageMeta = {
	url: string;
	width: number;
	height: number;
	type: string;
	alt: string;
};

/** Turn a path or absolute URL into a stable https://tashif.codes… URL. */
export function absoluteUrl(pathOrUrl?: string | null): string {
	if (!pathOrUrl) return SITE_ORIGIN;
	if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
	const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
	return `${SITE_ORIGIN}${path}`;
}

/**
 * Maps a site route pathname to its dedicated pre-rendered OG thumbnail.
 */
export function resolveRouteOgImage(pathname?: string | null): string | null {
	if (!pathname) return null;
	const clean = pathname.replace(/\/+$/, "").toLowerCase() || "/";

	if (clean === "/" || clean === "") return "/og/home.jpg";
	if (clean === "/resume" || clean === "/print-resume") return "/og/resume.jpg";
	if (clean === "/github") return "/og/github.jpg";
	if (clean === "/github/stats") return "/og/github-stats.jpg";
	if (clean === "/leetcode") return "/og/leetcode.jpg";
	if (clean === "/leetcode/stats") return "/og/leetcode-stats.jpg";
	if (clean === "/connect") return "/og/connect.jpg";
	if (clean === "/projects") return "/og/projects.jpg";
	if (clean === "/projects/stats") return "/og/projects-stats.jpg";
	if (clean.startsWith("/projects/")) {
		const slug = clean.replace("/projects/", "").split("/")[0];
		if (slug && slug !== "stats") {
			return `/og/projects/${encodeURIComponent(slug)}.jpg`;
		}
	}
	if (clean === "/docs") return "/og/docs.jpg";
	if (clean.startsWith("/docs/")) {
		const project = clean.replace("/docs/", "").split("/")[0];
		if (project) {
			return `/og/docs/${encodeURIComponent(project)}.jpg`;
		}
	}
	if (clean === "/fdroid") return "/og/fdroid.jpg";
	if (clean.startsWith("/download/")) {
		const title = clean.replace("/download/", "").split("/")[0];
		if (title) {
			return `/og/download/${encodeURIComponent(title)}.jpg`;
		}
	}
	if (clean === "/blog" || clean === "/blog/archive") return "/og/blog.jpg";

	return null;
}

/**
 * Pick a crawler-safe social image.
 *
 * Checks explicit image -> blog post slug -> route-based image -> default card.
 */
export function resolveSocialImage(options: {
	image?: string | null;
	blogSlug?: string;
	pathname?: string | null;
}): string {
	const { image, blogSlug, pathname } = options;

	if (image && image !== DEFAULT_OG_IMAGE) {
		const abs = absoluteUrl(image);
		if (RASTER_EXT.test(abs) && !SVG_EXT.test(abs)) return abs;
		// SVG (or unknown) — fall through to route/default
	}

	if (blogSlug) {
		// Build-time JPEG (opaque sRGB) — Discord/WhatsApp drop SVG and flaky PNGs.
		return absoluteUrl(`/og/blog/${encodeURIComponent(blogSlug)}.jpg`);
	}

	if (pathname) {
		const routeImage = resolveRouteOgImage(pathname);
		if (routeImage) {
			return absoluteUrl(routeImage);
		}
	}

	return DEFAULT_OG_IMAGE;
}

function mimeForImageUrl(url: string): string {
	const path = url.split("?")[0]?.toLowerCase() ?? "";
	if (path.endsWith(".png")) return "image/png";
	if (path.endsWith(".webp")) return "image/webp";
	if (path.endsWith(".gif")) return "image/gif";
	if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
	return "image/jpeg";
}

/**
 * Dimensions + MIME for og:image:* / twitter:image.
 * Cards are authored at 1200×630.
 */
export function resolveSocialImageMeta(options: {
	image?: string | null;
	blogSlug?: string;
	pathname?: string | null;
	alt: string;
}): SocialImageMeta {
	const url = resolveSocialImage(options);
	return {
		url,
		width: OG_IMAGE_WIDTH,
		height: OG_IMAGE_HEIGHT,
		type: mimeForImageUrl(url),
		alt: options.alt,
	};
}

export function defaultSeo(partial: SeoProps): Required<
	Pick<SeoProps, "title" | "description" | "image" | "url" | "type">
> &
	SeoProps {
	return {
		title: partial.title,
		description: partial.description?.trim() || DEFAULT_DESCRIPTION,
		image: resolveSocialImage({ image: partial.image, pathname: partial.url }),
		url: absoluteUrl(partial.url ?? "/"),
		type: partial.type || "website",
		publishedTime: partial.publishedTime,
		tags: partial.tags,
	};
}

export function siteAuthor() {
	return owner.name;
}
