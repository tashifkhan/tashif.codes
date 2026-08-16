import type { APIRoute } from "astro";
import { blogPosts, fetchAllPostsFull } from "@/data/blog";
import { escapeXml, cdata, rfc822 } from "@/lib/rss";

// Blog feed: mirrors the posts this site displays at /blog, pointing at the
// tashif.codes post pages. Full markdown is fetched in one bulk call
// (/posts/full) so feed readers get the whole article; when the blog API is
// unreachable the excerpt from the cached list payload is used instead.
const SITE = "https://tashif.codes";
const FEED_TITLE = "Blog — Tashif Ahmad Khan";
const FEED_DESCRIPTION =
	"Posts from Tashif Ahmad Khan on web development, programming, and technology.";

export const GET: APIRoute = async () => {
	let markdownBySlug = new Map<string, string>();
	try {
		const full = await fetchAllPostsFull();
		markdownBySlug = new Map(full.map((post) => [post.slug, post.markdown]));
	} catch (err) {
		console.error("Error fetching full posts for RSS:", err);
	}

	const items = blogPosts
		.filter((post) => post.title)
		.map((post) => {
			const url = `${SITE}/blog/${post.slug}`;
			const categories = (Array.isArray(post.tags) ? post.tags : [])
				.map((tag) => `\n\t\t<category>${escapeXml(tag)}</category>`)
				.join("");
			const description = cdata(
				markdownBySlug.get(post.slug) ?? post.excerpt ?? ""
			);

			return `\t<item>
\t\t<title>${escapeXml(post.title)}</title>
\t\t<link>${escapeXml(url)}</link>
\t\t<guid isPermaLink="true">${escapeXml(url)}</guid>
\t\t<pubDate>${rfc822(post.date)}</pubDate>${categories}
\t\t<author>${escapeXml(post.author || "Tashif Ahmad Khan")}</author>
\t\t<description>${description}</description>
\t</item>`;
		})
		.join("\n");

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
\t<title>${escapeXml(FEED_TITLE)}</title>
\t<link>${SITE}/blog</link>
\t<description>${escapeXml(FEED_DESCRIPTION)}</description>
\t<language>en-us</language>
\t<lastBuildDate>${rfc822()}</lastBuildDate>
\t<atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />
${items}
</channel>
</rss>`;

	return new Response(xml, {
		headers: {
			"Content-Type": "application/rss+xml; charset=utf-8",
			"Cache-Control": "public, max-age=0, must-revalidate",
		},
	});
};
