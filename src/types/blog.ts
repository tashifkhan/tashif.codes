/**
 * Blog post, comment, and metrics shapes.
 *
 * Mirrors the payloads returned by the blog API.
 */

export interface BlogPost {
	slug: string;
	title: string;
	date: string;
	author: string;
	tags: string[];
	excerpt: string;
	/** Public path or absolute URL of the post cover image. */
	coverImage?: string;
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

export interface BlogHeading {
	depth: number;
	text: string;
	slug: string;
}

/**
 * Metadata the API derives from a post's Markdown.
 *
 * Advisory — the Markdown is still the source of truth and is still rendered
 * locally. This is what lets the table of contents be built before paint rather
 * than scraped out of the DOM afterwards, and it carries the renderer version
 * so a post authored against a newer component vocabulary than this site's
 * renderer can be noticed.
 *
 * Optional because the field post-dates some deployed API versions.
 */
export interface BlogOutline {
	renderer: string;
	headings: BlogHeading[];
	components: string[];
	wordCount: number;
	readingTimeMinutes: number;
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
	renderer?: string;
	outline?: BlogOutline;
}
