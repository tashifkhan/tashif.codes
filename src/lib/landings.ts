/**
 * Custom project pages.
 *
 * Drop `src/landings/<project-slug>.astro` and `/projects/<slug>` renders that
 * file instead of the README. The README moves to `/projects/<slug>/readme`.
 * A project without a file here keeps the README view, so nothing needs
 * registering.
 *
 * A landing may `export const landing: LandingMeta = {...}` from its
 * frontmatter to change the header copy and the sticky call to action. The
 * colours always come from the visitor's own theme and accent.
 */
import type { AstroComponentFactory } from "astro/runtime/server/index.js";

export interface LandingMeta {
	/** Replaces the GitHub description in the header and in search results. */
	tagline?: string;
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
