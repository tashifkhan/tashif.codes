import type { APIRoute } from "astro";
import { allProjects } from "@/data/projects";
import { escapeXml, cdata, rfc822, rfc822Now } from "@/lib/rss";

// Projects feed: every repo shown on /projects, pointing at its project page.
// Pub date uses the newest release, then the last GitHub push date, and is
// omitted entirely when neither exists (pubDate is optional per RSS 2.0).
const SITE = "https://tashif.codes";
const FEED_TITLE = "Projects — Tashif Ahmad Khan";
const FEED_DESCRIPTION =
	"Things Tashif Ahmad Khan has built and shipped — web apps, tools, and experiments.";

export const GET: APIRoute = async () => {
	const withDates = allProjects
		.filter((project) => project.title)
		.map((project) => {
			const releases = (project.releases ?? []).filter(
				(r) => !r.draft && !r.prerelease
			);
			const published = releases
				.map((r) => r.published_at ?? r.created_at)
				.filter((d): d is string => Boolean(d))
				.sort()
				.reverse()[0];
			const dateRaw = published ?? project.updated_at ?? "";
			const time = dateRaw ? new Date(dateRaw).getTime() : NaN;
			return { project, time: Number.isNaN(time) ? -Infinity : time };
		})
		// Newest first; undated projects sink to the bottom in slug order.
		.sort(
			(a, b) =>
				b.time - a.time ||
				a.project.slug.localeCompare(b.project.slug)
		);

	const items = withDates
		.map(({ project }) => {
			const url = `${SITE}/projects/${project.slug}`;
			const releases = (project.releases ?? []).filter(
				(r) => !r.draft && !r.prerelease
			);
			const published = releases
				.map((r) => r.published_at ?? r.created_at)
				.filter((d): d is string => Boolean(d))
				.sort()
				.reverse()[0];
			const pubDate = rfc822(published ?? project.updated_at ?? "");

			const categories = [
				...new Set([...(project.topics ?? []), ...project.languages]),
			]
				.map((tag) => `\n\t\t<category>${escapeXml(tag)}</category>`)
				.join("");

			const meta = [
				project.languages.length > 0
					? `Languages: ${project.languages.join(", ")}`
					: "",
				project.stars ? `Stars: ${project.stars}` : "",
				project.forks ? `Forks: ${project.forks}` : "",
				project.live_website_url
					? `Live: ${project.live_website_url}`
					: "",
			]
				.filter(Boolean)
				.join(" · ");

			const description = cdata(
				[project.description, meta].filter(Boolean).join("\n\n")
			);

			const pubDateTag = pubDate
				? `\n\t\t<pubDate>${pubDate}</pubDate>`
				: "";

			return `\t<item>
\t\t<title>${escapeXml(project.title)}</title>
\t\t<link>${escapeXml(url)}</link>
\t\t<guid isPermaLink="true">${escapeXml(url)}</guid>${pubDateTag}${categories}
\t\t<description>${description}</description>
\t</item>`;
		})
		.join("\n");

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
\t<title>${escapeXml(FEED_TITLE)}</title>
\t<link>${SITE}/projects</link>
\t<description>${escapeXml(FEED_DESCRIPTION)}</description>
	<language>en-us</language>
	<lastBuildDate>${rfc822Now()}</lastBuildDate>
	<atom:link href="${SITE}/rss-projects.xml" rel="self" type="application/rss+xml" />
	<generator>tashif.codes RSS (Astro)</generator>
	<docs>https://www.rssboard.org/rss-specification</docs>
	<ttl>60</ttl>
${items}
</channel>
</rss>`;

	return new Response(xml, {
		headers: {
			"Content-Type": "application/rss+xml; charset=utf-8",
			"Cache-Control":
				"public, max-age=0, s-maxage=3600, stale-while-revalidate",
		},
	});
};
