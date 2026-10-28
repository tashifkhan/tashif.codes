import { blogPosts } from "../data/blog";
import { experiences } from "../data/experiences";
import { contactEmail, githubProfiles, owner, socials } from "../data/profile";
import { allProjects } from "../data/projects";
import {
	education,
	positions,
	resumeAbout,
	resumeProjects,
	skillCategories,
} from "../data/resume";
import { getDocProjects } from "./docProjects";
import { getAllDocs, processDocContent } from "./docs";
import { getAllDownloadProjects } from "./downloadRedirect";
import { DEFAULT_DESCRIPTION, SITE_ORIGIN } from "./seo";
import { TABS } from "./tabs";
import { clip, stripHtml } from "./webmcp";
import type { WebmcpCatalog } from "./webmcp-types";

export type { WebmcpCatalog, WebmcpDocPage, WebmcpDocProject, WebmcpPost, WebmcpProject } from "./webmcp-types";

function abs(path: string) {
	return new URL(path, SITE_ORIGIN).href;
}

export function buildWebmcpCatalog(): WebmcpCatalog {
	const docs = getDocProjects();
	return {
		site: SITE_ORIGIN,
		name: owner.name,
		description: DEFAULT_DESCRIPTION,
		email: contactEmail,
		studio: "https://taf.sh",
		pages: TABS.map((tab) => ({
			id: tab.id,
			href: tab.href,
			label: tab.label,
			url: abs(tab.href),
		})),
		socials: socials.map((item) => ({ label: item.label, url: item.link })),
		github: githubProfiles,
		projects: allProjects.map((project) => ({
			title: project.title,
			slug: project.slug,
			url: abs(`/projects/${project.slug}`),
			description: clip(project.description, 180),
			languages: project.languages ?? [],
			topics: project.topics ?? [],
			live: project.live_website_url ?? null,
			github: project.github_link,
			pinned: Boolean(project.pinned),
			stars: project.stars ?? null,
			docs: project.docs_slug ? abs(`/docs/${project.docs_slug}`) : null,
		})),
		posts: blogPosts.map((post) => ({
			slug: post.slug,
			title: post.title,
			url: abs(`/blog/${post.slug}`),
			date: post.date,
			tags: post.tags ?? [],
			excerpt: clip(post.excerpt || "", 180),
		})),
		docs: docs.map((project) => ({
			key: project.key,
			title: project.title,
			description: clip(project.description, 180),
			url: abs(`/docs/${project.docs_slug}`),
			pageCount: project.pageCount,
			languages: project.languages,
		})),
		docPages: getAllDocs().map((page) => {
			const project = page.props.project.toLowerCase();
			const slug = page.props.slug.replace(/\\/g, "/");
			return {
				project,
				slug,
				title: page.props.title,
				url: abs(`/docs/${project}/${slug}`),
				headings: page.props.headings.map((heading) => heading.text),
				snippet: clip(stripHtml(processDocContent(page.props.content)), 240),
			};
		}),
		downloads: getAllDownloadProjects().map((item) => ({
			title: item.title,
			url: abs(`/download/${item.title}`),
		})),
		resume: {
			pdf: abs("/resume:pdf"),
			location: resumeAbout.location,
			about: stripHtml(resumeAbout.introHtml),
			highlights: resumeAbout.highlights,
			experience: experiences.map((item) => ({
				company: item.company,
				role: item.role,
				period: item.period,
				points: item.points.map(stripHtml),
			})),
			projects: resumeProjects.map((item) => ({
				title: item.title,
				stack: item.stack,
				points: item.points.map(stripHtml),
				links: item.links,
			})),
			education: education.map((item) => ({
				institute: item.institute,
				period: item.period,
				degree: item.degree,
				details: item.details,
			})),
			positions: positions.map((item) => ({
				title: item.title,
				org: item.org,
				period: item.period,
				points: item.points.map(stripHtml),
			})),
			skills: skillCategories.map((item) => ({
				label: item.label,
				items: item.items,
			})),
		},
	};
}
