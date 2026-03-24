export const BLOG_API_BASE = "https://blog.tashif.codes/api";

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

/** Fetch the list of all blog posts with metadata. */
export async function fetchBlogPosts(): Promise<BlogPost[]> {
	const res = await fetch(`${BLOG_API_BASE}/posts.json`);
	if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status}`);
	return res.json();
}

/** Fetch a single post's full content, metrics, and comments. */
export async function fetchFullPost(slug: string): Promise<FullBlogPost> {
	const res = await fetch(`${BLOG_API_BASE}/posts/${slug}/full`);
	if (!res.ok) throw new Error(`Failed to fetch post "${slug}": ${res.status}`);
	const data = await res.json();
	return data.post;
}

/** Fetch (and increment) the view count for a post. */
export async function fetchViews(slug: string): Promise<number> {
	const res = await fetch(`${BLOG_API_BASE}/views/${slug}`);
	if (!res.ok) throw new Error(`Failed to fetch views for "${slug}"`);
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

/** Fetch all posts with full content, metrics, and comments (bulk). */
export async function fetchAllPostsFull(): Promise<FullBlogPost[]> {
	const res = await fetch(`${BLOG_API_BASE}/posts/full`);
	if (!res.ok) throw new Error(`Failed to fetch all posts: ${res.status}`);
	const data = await res.json();
	return data.posts ?? [];
}

/** Post a new top-level comment or reply. */
export async function postComment(
	slug: string,
	payload: { name: string; text: string; parentId?: string }
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
