import type { APIRoute } from "astro";
import { buildWebmcpCatalog } from "../lib/webmcp-catalog";

export const prerender = true;

export const GET: APIRoute = () =>
	new Response(JSON.stringify(buildWebmcpCatalog()), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
