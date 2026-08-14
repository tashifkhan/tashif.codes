/**
 * Helpers shared by the block components.
 *
 * These mirror the arithmetic the old string-emitting registry did inline.
 * They live here rather than in `pipeline/` because they are presentation
 * concerns — clamping a score to 0–10 is part of how a Meter looks, not part
 * of how Markdown parses.
 */

import type { MarkdownTheme } from "../pipeline/theme";

export const MAX_ROTATE = 15;

export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/**
 * Read a numeric attribute.
 *
 * Written as an explicit check rather than `Number(x) || fallback`, which
 * would quietly discard a deliberate `0` — `max={0}` is a typo worth rendering
 * as an empty bar, not silently as `max={100}`.
 */
export function num(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Rotation, as a custom property.
 *
 * Opt-in per site: `markdown.css` multiplies it by `--md-rotate`, which
 * defaults to `0`, so the zine tilt is available without being imposed on a
 * design system that does not want it.
 */
export function rotateStyle(value: unknown): string | undefined {
	const degrees =
		typeof value === "number" ? clamp(value, -MAX_ROTATE, MAX_ROTATE) : 0;
	return degrees ? `--md-rotate-local: ${degrees}deg` : undefined;
}

/** Join `style` fragments, dropping the empty ones. */
export function styles(
	...parts: Array<string | undefined | false>
): string | undefined {
	const kept = parts.filter(Boolean) as string[];
	return kept.length ? kept.join("; ") : undefined;
}

/** Props every block receives from the substitution pass. */
export interface BlockProps {
	attrs: Record<string, string | number | boolean | undefined>;
	theme: MarkdownTheme;
	headings: ReadonlyArray<{ depth: number; text: string; slug: string }>;
	inline: boolean;
}
