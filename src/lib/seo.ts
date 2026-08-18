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
 * Pick a crawler-safe social image.
 *
 * Prefer an explicit raster URL; for blog posts with SVG covers use the
 * build-time PNG at /og/blog/<slug>.png; otherwise the site default card.
 */
export function resolveSocialImage(options: {
	image?: string | null;
	blogSlug?: string;
}): string {
	const { image, blogSlug } = options;

	if (image) {
		const abs = absoluteUrl(image);
		if (RASTER_EXT.test(abs) && !SVG_EXT.test(abs)) return abs;
		// SVG (or unknown) — fall through to generated blog PNG / default
	}

	if (blogSlug) {
		return absoluteUrl(`/og/blog/${encodeURIComponent(blogSlug)}.png`);
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
 * Blog PNGs and the default card are authored at 1200×630.
 */
export function resolveSocialImageMeta(options: {
	image?: string | null;
	blogSlug?: string;
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
		image: resolveSocialImage({ image: partial.image }),
		url: absoluteUrl(partial.url ?? "/"),
		type: partial.type ?? "website",
		publishedTime: partial.publishedTime,
		tags: partial.tags,
	};
}

export function siteAuthor() {
	return owner.name;
}
