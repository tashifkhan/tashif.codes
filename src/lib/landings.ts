/**
 * Custom project pages.
 *
 * Drop `src/landings/<project-slug>.astro` and `/projects/<slug>` renders that
 * file instead of the README. The README moves to `/projects/<slug>/readme`.
 * A project without a file here keeps the README view, so nothing needs
 * registering.
 *
 * A landing may `export const landing: LandingMeta = {...}` from its
 * frontmatter to change the header copy, the accent colour and the sticky
 * call to action.
 */
import type { AstroComponentFactory } from "astro/runtime/server/index.js";

export interface LandingAccent {
	/** Accent on light surfaces. Any CSS colour. */
	light: string;
	/** Accent on dark surfaces. Usually a lighter tint of `light`. */
	dark: string;
	/** Text colour on top of the accent. Defaults to white on light, near-black on dark. */
	onLight?: string;
	onDark?: string;
}

export interface LandingMeta {
	/** Replaces the GitHub description in the header and in search results. */
	tagline?: string;
	/** Replaces `--primary` for this project's pages, in every skin. */
	accent?: LandingAccent;
	/** Primary button in the header and in the sticky bar. */
	cta?: { label: string; href: string; external?: boolean };
}

interface LandingModule {
	default: AstroComponentFactory;
	landing?: LandingMeta;
}

const modules = import.meta.glob<LandingModule>("../landings/*.astro", {
	eager: true,
});

const bySlug = new Map<string, LandingModule>(
	Object.entries(modules).map(([path, mod]) => [
		path.split("/").pop()!.replace(/\.astro$/, "").toLowerCase(),
		mod,
	]),
);

export const hasLanding = (slug: string): boolean =>
	bySlug.has(slug.toLowerCase());

export const getLanding = (slug: string): LandingModule | undefined =>
	bySlug.get(slug.toLowerCase());

/** Scoped token override for a landing's accent. Empty when none is set. */
export function accentCss(accent?: LandingAccent): string {
	if (!accent) return "";
	const onLight = accent.onLight ?? "#ffffff";
	const onDark = accent.onDark ?? "#06140f";
	return [
		`[data-page-shell]{--primary:${accent.light};--primary-foreground:${onLight};--ring:${accent.light};}`,
		`.dark [data-page-shell]{--primary:${accent.dark};--primary-foreground:${onDark};--ring:${accent.dark};}`,
	].join("");
}
