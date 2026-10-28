import type { APIRoute } from "astro";
import { contactEmail } from "../data/profile";
import { DEFAULT_DESCRIPTION, SITE_ORIGIN } from "../lib/seo";
import { TABS } from "../lib/tabs";
import { buildWebmcpCatalog } from "../lib/webmcp-catalog";

export const prerender = true;

export const GET: APIRoute = () => {
	const catalog = buildWebmcpCatalog();
	const pages = TABS.map((tab) => `- [${tab.label}](${new URL(tab.href, SITE_ORIGIN).href})`).join("\n");
	const body = `# tashif.codes

> ${DEFAULT_DESCRIPTION}

tashif.codes is Tashif Ahmad Khan's personal dashboard, blog, project directory and developer tools. Studio work lives at https://taf.sh. Contact him at ${contactEmail}.

## Pages

${pages}
- [Docs](${SITE_ORIGIN}/docs)
- [F-Droid apps](${SITE_ORIGIN}/fdroid)
- [Resume PDF](${SITE_ORIGIN}/resume:pdf)
- [Blog RSS](${SITE_ORIGIN}/rss.xml)
- [Projects RSS](${SITE_ORIGIN}/rss-projects.xml)

The site currently lists ${catalog.projects.length} projects, ${catalog.posts.length} blog posts and ${catalog.docs.length} documentation trees.

## In-browser tools (WebMCP)

When an agent is visiting this site in a live tab, the page registers tools on document.modelContext. They are not HTTP APIs. Crawlers that never run JavaScript should keep using this file and the public HTML pages. The static tool list is at /.well-known/webmcp.json (also /webmcp.json). Site content used by those tools is at /webmcp-catalog.json.

Tools: get_site_overview, list_projects, search_projects, get_project, list_blog_posts, get_blog_post, list_docs, search_docs, get_doc_page, get_resume, list_downloads, open_tab, get_contact, copy_email, start_contact.

start_contact drafts a message to ${contactEmail}, fills the connect form when it is on the page, and opens the visitor's mail app. It does not send mail. In-chat agents such as Grok should show the returned draft and send it from the user's mailbox after they confirm.

## Optional

- [WebMCP tool list](${SITE_ORIGIN}/.well-known/webmcp.json)
- [Studio site](https://taf.sh/): Independent software studio and consultancy.
- [Studio crawler guide](https://taf.sh/llms.txt)
- [GitHub](https://github.com/tashifkhan)
`;
	return new Response(body, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};
