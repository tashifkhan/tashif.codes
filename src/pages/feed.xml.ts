import type { APIRoute } from "astro";
import { buildBlogFeedXml } from "@/lib/blog-feed";

// Conventional alias: many readers probe /feed.xml before <link rel=alternate>.
// Same posts as /rss.xml; only the atom self-link differs.
export const GET: APIRoute = async () => {
	const xml = await buildBlogFeedXml("/feed.xml");
	return new Response(xml);
};
