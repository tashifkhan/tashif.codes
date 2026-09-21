import type { APIRoute } from "astro";
import { blogFeedHeaders, buildBlogFeedXml } from "@/lib/blog-feed";

// Blog feed: mirrors the posts this site displays at /blog, pointing at the
// tashif.codes post pages. Full markdown is rendered with the same renderer
// as blog/[slug].astro so feed readers get HTML — not raw markdown and custom
// tags; when the blog API is unreachable the excerpt is used instead.
export const GET: APIRoute = async () => {
	const xml = await buildBlogFeedXml();
	return new Response(xml, { headers: blogFeedHeaders() });
};
