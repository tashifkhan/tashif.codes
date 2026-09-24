import type { APIRoute } from "astro";
import { buildBlogFeedXml } from "@/lib/blog-feed";

// Blog feed: mirrors the posts this site displays at /blog, pointing at the
// tashif.codes post pages. Full markdown is rendered with the same renderer
// as blog/[slug].astro so feed readers get HTML — not raw markdown and custom
// tags; when the blog API is unreachable the excerpt is used instead.
// Headers live in vercel.json: this route is prerendered, so headers set on
// the Response never reach the client.
export const GET: APIRoute = async () => {
	const xml = await buildBlogFeedXml();
	return new Response(xml);
};
