import type { APIRoute } from "astro";
import { buildBlogFeedXml } from "@/lib/blog-feed";

// Conventional alias for readers that derive /blog/rss.xml from the section URL.
// Same posts as /rss.xml; only the atom self-link differs.
export const GET: APIRoute = async () => {
	const xml = await buildBlogFeedXml("/blog/rss.xml");
	return new Response(xml);
};
