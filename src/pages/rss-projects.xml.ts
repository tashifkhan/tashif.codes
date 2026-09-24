import type { APIRoute } from "astro";
import { allProjects } from "@/data/projects";
import { SITE, buildChannel, cdata, escapeXml, rfc822 } from "@/lib/rss";

// Projects feed: every repo shown on /projects, pointing at its project page.
// Pub date uses the newest release, then the last GitHub push date, and is
// omitted entirely when neither exists (pubDate is optional per RSS 2.0).
// Content-Type and Cache-Control come from vercel.json: this route is
// prerendered, so headers set on the Response never reach the client.
const FEED_TITLE = "Projects — Tashif Ahmad Khan";
const FEED_DESCRIPTION =
	"Things Tashif Ahmad Khan has built and shipped — web apps, tools, and experiments.";

type Project = (typeof allProjects)[number];

/** Newest stable release date, else last push date, else undefined. */
const projectDate = (project: Project): string | undefined => {
	const published = (project.releases ?? [])
		.filter((r) => !r.draft && !r.prerelease)
		.map((r) => r.published_at ?? r.created_at)
		.filter((d): d is string => Boolean(d))
		.sort()
		.reverse()[0];
	return published ?? project.updated_at ?? undefined;
};

const buildItem = (project: Project, date: string | undefined): string => {
	const url = `${SITE}/projects/${project.slug}`;
	const pubDate = rfc822(date);
	const pubDateTag = pubDate ? `\n\t\t<pubDate>${pubDate}</pubDate>` : "";

	const categories = [
		...new Set([...(project.topics ?? []), ...project.languages]),
	]
		.map((tag) => `\n\t\t<category>${escapeXml(tag)}</category>`)
		.join("");

	const meta = [
		project.languages.length > 0
			? `Languages: ${escapeXml(project.languages.join(", "))}`
			: "",
		project.stars ? `Stars: ${project.stars}` : "",
		project.forks ? `Forks: ${project.forks}` : "",
		project.live_website_url
			? `Live: <a href="${escapeXml(project.live_website_url)}">${escapeXml(project.live_website_url)}</a>`
			: "",
	]
		.filter(Boolean)
		.join(" · ");

	// HTML paragraphs: readers collapse bare newlines into one line.
	const description = cdata(
		[project.description ? escapeXml(project.description) : "", meta]
			.filter(Boolean)
			.map((para) => `<p>${para}</p>`)
			.join(""),
	);

	return `\t<item>
\t\t<title>${escapeXml(project.title)}</title>
\t\t<link>${escapeXml(url)}</link>
\t\t<guid isPermaLink="true">${escapeXml(url)}</guid>${pubDateTag}${categories}
\t\t<description>${description}</description>
\t</item>`;
};

export const GET: APIRoute = async () => {
	const items = allProjects
		.filter((project) => project.title)
		.map((project) => {
			const date = projectDate(project);
			const time = date ? new Date(date).getTime() : NaN;
			return {
				project,
				date,
				time: Number.isNaN(time) ? -Infinity : time,
			};
		})
		// Newest first; undated projects sink to the bottom in slug order.
		.sort(
			(a, b) =>
				b.time - a.time || a.project.slug.localeCompare(b.project.slug),
		)
		.map(({ project, date }) => buildItem(project, date));

	const xml = buildChannel({
		title: FEED_TITLE,
		link: `${SITE}/projects`,
		description: FEED_DESCRIPTION,
		selfPath: "/rss-projects.xml",
		items,
	});
	return new Response(xml);
};
