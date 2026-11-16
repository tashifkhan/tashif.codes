/**
 * Blog helpers that are safe in the browser.
 *
 * `src/data/blog.ts` fetches at module load, so client scripts must not import
 * it. Everything both sides need (date formatting, topic slugs, search
 * matching, comment counts, related posts) lives here instead.
 */

type Meta = { metadata?: Record<string, unknown> };

/**
 * Post dates are date-only strings ("2026-08-15"), which JavaScript reads as
 * UTC midnight. Formatting them in the reader's zone shows the previous day
 * west of UTC, so every display format pins UTC.
 */
const DATE_FORMATS = {
	short: { month: "short", day: "numeric", year: "numeric" },
	long: { month: "long", day: "numeric", year: "numeric" },
	monthDay: { month: "short", day: "numeric" },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

export type PostDateStyle = keyof typeof DATE_FORMATS;

export function parsePostDate(value: string): Date | null {
	const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
	return Number.isNaN(date.getTime()) ? null : date;
}

export function formatPostDate(value: string, style: PostDateStyle = "short"): string {
	const date = parsePostDate(value);
	if (!date) return value;
	return date.toLocaleDateString("en-US", { ...DATE_FORMATS[style], timeZone: "UTC" });
}

/** Year the post was published, for list grouping. */
export function postYear(value: string): string {
	return String(parsePostDate(value)?.getUTCFullYear() ?? "");
}

/** URL form of a topic: "Data & ML" -> "data-and-ml". */
export function topicSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/**
 * Posts can opt out of lists with `unlisted: true` in frontmatter. The API
 * passes unknown frontmatter keys through in `metadata`. An unlisted post still
 * gets a page, so direct links keep working.
 */
export function isListedPost(post: Meta): boolean {
	return post.metadata?.unlisted !== true;
}

/**
 * Search match: every word of the query must appear somewhere in the fields,
 * as a plain substring. No letter-in-order matching, which made "rust" match
 * seven posts that never mention Rust.
 */
export function matchesQuery(fields: string[], query: string): boolean {
	const words = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (!words.length) return true;
	const haystack = fields.join(" ").toLowerCase();
	return words.every((word) => haystack.includes(word));
}

/** Total comments including replies at every depth. */
export function countComments(list: { replies?: unknown[] }[] | undefined): number {
	if (!Array.isArray(list)) return 0;
	return list.reduce(
		(sum, comment) =>
			sum + 1 + countComments(comment.replies as { replies?: unknown[] }[] | undefined),
		0,
	);
}

type RelatableNode = Meta & { slug: string; date: string; tags?: string[] };

/**
 * Related posts for the end of an article.
 *
 * Frontmatter `related: [slug, ...]` wins, in the order written. Remaining
 * slots go to posts sharing the most tags, newest first on ties. `exclude`
 * keeps the newer/older links from repeating in the related row; it never
 * removes a post the author pinned.
 */
export function pickRelatedPosts<T extends RelatableNode>(
	post: T,
	posts: T[],
	{ limit = 3, exclude = [] }: { limit?: number; exclude?: string[] } = {},
): T[] {
	const bySlug = new Map(posts.map((p) => [p.slug, p]));
	const chosen: T[] = [];

	const pinned = post.metadata?.related;
	if (Array.isArray(pinned)) {
		for (const slug of pinned) {
			const match = bySlug.get(String(slug));
			if (match && match.slug !== post.slug && !chosen.includes(match)) chosen.push(match);
			if (chosen.length >= limit) return chosen;
		}
	}

	const skip = new Set([post.slug, ...exclude, ...chosen.map((p) => p.slug)]);
	const tags = new Set(post.tags ?? []);
	const byOverlap = posts
		.filter((p) => !skip.has(p.slug))
		.map((p) => ({ p, shared: (p.tags ?? []).filter((t) => tags.has(t)).length }))
		.filter((entry) => entry.shared > 0)
		.sort(
			(a, b) =>
				b.shared - a.shared ||
				(parsePostDate(b.p.date)?.getTime() ?? 0) - (parsePostDate(a.p.date)?.getTime() ?? 0),
		)
		.map((entry) => entry.p);

	return [...chosen, ...byOverlap].slice(0, limit);
}
