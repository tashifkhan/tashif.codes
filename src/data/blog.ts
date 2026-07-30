export const BLOG_API_BASE = "https://blog.tashif.codes/api";

/**
 * Repository the posts live in.
 *
 * blog.tashif.codes passes this to its renderer, so this site has to pass it
 * too or the same post renders differently here: relative image paths,
 * `file://` links, and `<cite>` reference blocks all need it to resolve.
 */
export const BLOG_REPO_URL = "https://github.com/tashifkhan/Blog";

export interface BlogPost {
	slug: string;
	title: string;
	date: string;
	author: string;
	tags: string[];
	excerpt: string;
	socials: string[];
	category: string | null;
	wordCount?: number;
	readingTimeMinutes?: number;
	metadata?: Record<string, unknown>;
}

export interface BlogComment {
	id: string;
	name: string;
	text: string;
	date: string;
	replies: BlogComment[];
}

export interface BlogMetrics {
	views: number;
	likes: number;
	commentsCount: number;
}

export interface FullBlogPost {
	slug: string;
	markdown: string;
	metadata: {
		title?: string;
		date?: string;
		author?: string;
		[key: string]: unknown;
	};
	metrics: BlogMetrics;
	comments: BlogComment[];
}

const toFiniteNumber = (value: unknown): number =>
	typeof value === "number" && Number.isFinite(value) ? value : 0;

const WORDS_PER_MINUTE = 200;

/** Sort posts newest-first (stable secondary by slug). */
export function sortBlogPostsNewestFirst<T extends { date: string; slug: string }>(
	posts: T[],
): T[] {
	return [...posts].sort((a, b) => {
		const byDate = new Date(b.date).getTime() - new Date(a.date).getTime();
		if (byDate !== 0) return byDate;
		return a.slug.localeCompare(b.slug);
	});
}

/** Unique tags across posts (used as filter categories). */
export function getBlogCategories(posts: BlogPost[]): string[] {
	return [
		...new Set(
			posts.flatMap((post) => (Array.isArray(post.tags) ? post.tags : [])),
		),
	];
}

/** Word count + reading time from markdown body (200 wpm, min 1 min). */
export function estimateReadingStats(
	markdown: string,
	wpm: number = WORDS_PER_MINUTE,
): { wordCount: number; readingTimeMinutes: number } {
	const wordCount = markdown
		.trim()
		.split(/\s+/)
		.filter(Boolean).length;
	return {
		wordCount,
		readingTimeMinutes: Math.max(1, Math.round(wordCount / wpm) || 1),
	};
}

/** Resolve reading time from post fields (API / metadata / word count). */
export function resolveReadingTimeMinutes(post: BlogPost): number {
	const fromApi = toFiniteNumber(post.readingTimeMinutes);
	if (fromApi > 0) return fromApi;
	const fromMeta = toFiniteNumber(post.metadata?.readingTimeMinutes);
	if (fromMeta > 0) return fromMeta;
	const words =
		toFiniteNumber(post.wordCount) || toFiniteNumber(post.metadata?.wordCount);
	if (words > 0) return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
	return 1;
}

/** Total word count (API field, then metadata fallback — never both). */
export function getTotalBlogWords(posts: BlogPost[]): number {
	return posts.reduce((sum, p) => {
		const words =
			toFiniteNumber(p.wordCount) || toFiniteNumber(p.metadata?.wordCount);
		return sum + words;
	}, 0);
}

/** Average reading time in minutes (API field, then metadata fallback). */
export function getAvgReadingMinutes(posts: BlogPost[]): number {
	if (posts.length === 0) return 0;
	const total = posts.reduce((s, p) => s + resolveReadingTimeMinutes(p), 0);
	return Math.round(total / posts.length);
}

/**
 * Fetch the list of all blog posts with metadata.
 * Throws on HTTP errors so callers can handle failures explicitly.
 */
export async function fetchBlogPosts(): Promise<BlogPost[]> {
	const res = await fetch(`${BLOG_API_BASE}/posts.json`);
	if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status}`);
	const data = await res.json();
	if (!Array.isArray(data)) {
		throw new Error("Blog posts response was not an array");
	}
	return sortBlogPostsNewestFirst(data as BlogPost[]);
}

/**
 * Fill missing wordCount / readingTimeMinutes at build time from full
 * markdown so list cards never fall back to a useless "1 min" heuristic.
 */
async function enrichPostsWithReadingStats(
	posts: BlogPost[],
): Promise<BlogPost[]> {
	const needsBody = posts.some(
		(p) =>
			toFiniteNumber(p.readingTimeMinutes) <= 0 &&
			toFiniteNumber(p.metadata?.readingTimeMinutes) <= 0 &&
			toFiniteNumber(p.wordCount) <= 0 &&
			toFiniteNumber(p.metadata?.wordCount) <= 0,
	);

	// Normalize posts that already have one of the fields from the list API.
	if (!needsBody) {
		return posts.map((post) => {
			const wordCount =
				toFiniteNumber(post.wordCount) ||
				toFiniteNumber(post.metadata?.wordCount);
			const readingTimeMinutes = resolveReadingTimeMinutes(post);
			return {
				...post,
				...(wordCount > 0 ? { wordCount } : {}),
				readingTimeMinutes,
			};
		});
	}

	let fullBySlug = new Map<string, FullBlogPost>();
	try {
		const full = await fetchAllPostsFull();
		fullBySlug = new Map(full.map((p) => [p.slug, p]));
	} catch (err) {
		console.error("Error fetching full posts for reading stats:", err);
	}

	return posts.map((post) => {
		const existingWords =
			toFiniteNumber(post.wordCount) ||
			toFiniteNumber(post.metadata?.wordCount);
		const existingMins =
			toFiniteNumber(post.readingTimeMinutes) ||
			toFiniteNumber(post.metadata?.readingTimeMinutes);

		if (existingWords > 0 || existingMins > 0) {
			const wordCount = existingWords;
			const readingTimeMinutes =
				existingMins > 0
					? existingMins
					: Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
			return {
				...post,
				...(wordCount > 0 ? { wordCount } : {}),
				readingTimeMinutes,
			};
		}

		const markdown = fullBySlug.get(post.slug)?.markdown;
		if (!markdown) {
			return { ...post, readingTimeMinutes: 1 };
		}

		const stats = estimateReadingStats(markdown);
		return { ...post, ...stats };
	});
}

/**
 * Safe fetch used at build/module load time.
 * Returns [] on failure instead of throwing (matches github/leetcode modules).
 * Always enriches reading time / word count for static list rendering.
 */
async function loadBlogPosts(): Promise<BlogPost[]> {
	try {
		const posts = await fetchBlogPosts();
		return await enrichPostsWithReadingStats(posts);
	} catch (err) {
		console.error("Error fetching blog posts:", err);
		return [];
	}
}

/** Fetch a single post's full content, metrics, and comments. */
export async function fetchFullPost(slug: string): Promise<FullBlogPost> {
	const res = await fetch(`${BLOG_API_BASE}/posts/${slug}/full`);
	if (!res.ok) throw new Error(`Failed to fetch post "${slug}": ${res.status}`);
	const data = await res.json();
	return data.post;
}

/** Fetch the view count for a post. Read-only: does not record a view. */
export async function fetchViews(slug: string): Promise<number> {
	const res = await fetch(`${BLOG_API_BASE}/views/${slug}`);
	if (!res.ok) throw new Error(`Failed to fetch views for "${slug}"`);
	const data = await res.json();
	return data.views;
}

/**
 * Record a view for this client and return the updated count.
 *
 * De-duplicated server-side per viewer within a rolling window, so calling it
 * on every page load will not inflate the count.
 */
export async function recordView(slug: string): Promise<number> {
	const res = await fetch(`${BLOG_API_BASE}/views/${slug}`, { method: "POST" });
	if (!res.ok) throw new Error(`Failed to record view for "${slug}"`);
	const data = await res.json();
	return data.views;
}

/** Fetch the like count for a post. */
export async function fetchLikes(slug: string): Promise<number> {
	const res = await fetch(`${BLOG_API_BASE}/likes/${slug}`);
	if (!res.ok) throw new Error(`Failed to fetch likes for "${slug}"`);
	const data = await res.json();
	return data.likes;
}

/** Increment likes for a post. */
export async function addLike(slug: string): Promise<number> {
	const res = await fetch(`${BLOG_API_BASE}/likes/${slug}`, { method: "POST" });
	if (!res.ok) throw new Error(`Failed to like "${slug}"`);
	const data = await res.json();
	return data.likes;
}

/** Decrement likes for a post. */
export async function removeLike(slug: string): Promise<number> {
	const res = await fetch(`${BLOG_API_BASE}/likes/${slug}`, { method: "DELETE" });
	if (!res.ok) throw new Error(`Failed to unlike "${slug}"`);
	const data = await res.json();
	return data.likes;
}

/** Fetch the threaded comment tree for a post. */
export async function fetchComments(slug: string): Promise<BlogComment[]> {
	const res = await fetch(`${BLOG_API_BASE}/comments/${slug}`);
	if (!res.ok) throw new Error(`Failed to fetch comments for "${slug}"`);
	const data = await res.json();
	return data.comments;
}

/** Normalize `/posts/full` payloads (API returns a bare array). */
function normalizeFullPostsPayload(data: unknown): FullBlogPost[] {
	if (Array.isArray(data)) return data as FullBlogPost[];
	if (
		data &&
		typeof data === "object" &&
		Array.isArray((data as { posts?: unknown }).posts)
	) {
		return (data as { posts: FullBlogPost[] }).posts;
	}
	return [];
}

/** Fetch all posts with full content, metrics, and comments (bulk). */
export async function fetchAllPostsFull(): Promise<FullBlogPost[]> {
	const res = await fetch(`${BLOG_API_BASE}/posts/full`);
	if (!res.ok) throw new Error(`Failed to fetch all posts: ${res.status}`);
	const data = await res.json();
	return normalizeFullPostsPayload(data);
}

/** Post a new top-level comment or reply. */
export async function postComment(
	slug: string,
	payload: { name: string; text: string; parentId?: string },
): Promise<BlogComment> {
	const res = await fetch(`${BLOG_API_BASE}/comments/${slug}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	if (!res.ok) throw new Error(`Failed to post comment for "${slug}"`);
	const data = await res.json();
	return data.comment;
}

// ── Build-time / module-load exports (same pattern as github / leetcode) ────

/** All blog posts, newest first. Empty array if the API is unreachable. */
export const blogPosts: BlogPost[] = await loadBlogPosts();

/** ISO timestamp when blog list data was last fetched (build / server). */
export const blogFetchedAt: string = new Date().toISOString();

export const blogCategories: string[] = getBlogCategories(blogPosts);
export const totalBlogWords: number = getTotalBlogWords(blogPosts);
export const avgReadingMinutes: number = getAvgReadingMinutes(blogPosts);
export const numBlogPosts: number = blogPosts.length;
