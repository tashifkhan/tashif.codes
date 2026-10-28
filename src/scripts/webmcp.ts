import { TABS, type TabId } from "../lib/tabs";
import type { WebmcpCatalog, WebmcpDocPage, WebmcpPost, WebmcpProject } from "../lib/webmcp-types";
import {
	buildMailto,
	contactDraft,
	copyText,
	isEmail,
	openMailto,
	registerTools,
	type WebmcpTool,
} from "../lib/webmcp";

function score(haystack: string, needle: string) {
	const text = haystack.toLowerCase();
	const query = needle.toLowerCase();
	if (!query) return 1;
	if (text === query) return 100;
	if (text.includes(query)) return 80;
	const words = query.split(/\s+/).filter(Boolean);
	if (words.length && words.every((word) => text.includes(word))) return 50;
	return 0;
}

function matchProject(project: WebmcpProject, query: string) {
	return Math.max(
		score(project.title, query),
		score(project.slug, query),
		score(project.description, query),
		score(project.languages.join(" "), query),
		score(project.topics.join(" "), query),
	);
}

function matchPost(post: WebmcpPost, query: string) {
	return Math.max(
		score(post.title, query),
		score(post.slug, query),
		score(post.excerpt, query),
		score(post.tags.join(" "), query),
	);
}

function matchDoc(page: WebmcpDocPage, query: string) {
	const needle = query.trim().toLowerCase();
	const qualified = `${page.project}/${page.slug}`.toLowerCase();
	if (page.slug.toLowerCase() === needle || qualified === needle) return 120;
	return Math.max(
		score(page.slug, query),
		score(qualified, query),
		score(page.title, query),
		score(page.project, query),
		score(page.snippet, query),
		score(page.headings.join(" "), query),
	);
}

function fillContactForm(fields: {
	name?: string;
	email?: string;
	subject?: string;
	message?: string;
}) {
	const form = document.getElementById("contact-form");
	if (!(form instanceof HTMLFormElement)) return false;
	const set = (id: string, value?: string) => {
		if (!value) return;
		const field = document.getElementById(id);
		if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
			field.value = value;
		}
	};
	set("contact-name", fields.name);
	set("contact-email", fields.email);
	set("contact-subject", fields.subject);
	set("contact-message", fields.message);
	form.scrollIntoView({ block: "center" });
	return true;
}

function tools(catalog: WebmcpCatalog): WebmcpTool[] {
	return [
		{
			name: "get_site_overview",
			description: "Overview of tashif.codes, Tashif Ahmad Khan, and the public sections of this site.",
			inputSchema: { type: "object", properties: {} },
			annotations: { readOnlyHint: true },
			execute: () => ({
				name: catalog.name,
				site: catalog.site,
				description: catalog.description,
				email: catalog.email,
				studio: catalog.studio,
				pages: catalog.pages,
				projectCount: catalog.projects.length,
				postCount: catalog.posts.length,
				docCount: catalog.docs.length,
				github: catalog.github,
			}),
		},
		{
			name: "list_projects",
			description: "List public projects. Optional query filters by name, slug, language, or topic.",
			inputSchema: {
				type: "object",
				properties: {
					query: { type: "string", description: "Optional search text" },
					limit: { type: "number", description: "Max results, default 20" },
				},
			},
			annotations: { readOnlyHint: true },
			execute: ({ query, limit }) => {
				const needle = String(query ?? "").trim();
				const cap = Math.min(50, Math.max(1, Number(limit) || 20));
				const ranked = (needle
					? catalog.projects
							.map((project) => ({ project, rank: matchProject(project, needle) }))
							.filter((item) => item.rank > 0)
							.sort((a, b) => b.rank - a.rank || (b.project.stars ?? 0) - (a.project.stars ?? 0))
							.map((item) => item.project)
					: [...catalog.projects].sort(
							(a, b) => Number(b.pinned) - Number(a.pinned) || (b.stars ?? 0) - (a.stars ?? 0),
						)
				).slice(0, cap);
				return { total: catalog.projects.length, shown: ranked.length, projects: ranked };
			},
		},
		{
			name: "search_projects",
			description:
				"Search projects and, when the dashboard is on screen, apply the same filter to the visible cards.",
			inputSchema: {
				type: "object",
				properties: {
					query: { type: "string", description: "Search text" },
				},
				required: ["query"],
			},
			annotations: { readOnlyHint: true },
			execute: ({ query }) => {
				const needle = String(query ?? "").trim();
				if (!needle) return { ok: false, error: "Add a search query." };
				const matches = catalog.projects
					.map((project) => ({ project, rank: matchProject(project, needle) }))
					.filter((item) => item.rank > 0)
					.sort((a, b) => b.rank - a.rank)
					.slice(0, 20)
					.map((item) => item.project);
				const filteredUi = Boolean(document.querySelector("[data-project-item-card]"));
				if (filteredUi) {
					document.dispatchEvent(
						new CustomEvent("project-search", {
							detail: {
								term: needle,
								showLiveOnly: false,
								showReleasesOnly: false,
								list: "all-projects",
							},
						}),
					);
				}
				return { query: needle, filteredOnPage: filteredUi, matches };
			},
		},
		{
			name: "get_project",
			description: "Get one project by name or slug.",
			inputSchema: {
				type: "object",
				properties: {
					query: { type: "string", description: "Project name or slug" },
				},
				required: ["query"],
			},
			annotations: { readOnlyHint: true },
			execute: ({ query }) => {
				const needle = String(query ?? "").trim();
				if (!needle) return { ok: false, error: "Add a project name or slug." };
				const match = catalog.projects
					.map((project) => ({ project, rank: matchProject(project, needle) }))
					.filter((item) => item.rank > 0)
					.sort((a, b) => b.rank - a.rank)[0];
				if (!match) return { ok: false, error: "No matching project." };
				return match.project;
			},
		},
		{
			name: "list_blog_posts",
			description: "List blog posts, newest first. Optional tag filter.",
			inputSchema: {
				type: "object",
				properties: {
					tag: { type: "string", description: "Optional tag" },
					limit: { type: "number", description: "Max results, default 15" },
				},
			},
			annotations: { readOnlyHint: true },
			execute: ({ tag, limit }) => {
				const needle = String(tag ?? "").trim().toLowerCase();
				const cap = Math.min(40, Math.max(1, Number(limit) || 15));
				const posts = catalog.posts
					.filter((post) => !needle || post.tags.some((item) => item.toLowerCase() === needle))
					.slice(0, cap);
				return { total: catalog.posts.length, shown: posts.length, posts };
			},
		},
		{
			name: "get_blog_post",
			description: "Get one blog post by slug or title.",
			inputSchema: {
				type: "object",
				properties: {
					query: { type: "string", description: "Post slug or title" },
				},
				required: ["query"],
			},
			annotations: { readOnlyHint: true },
			execute: ({ query }) => {
				const needle = String(query ?? "").trim();
				if (!needle) return { ok: false, error: "Add a post slug or title." };
				const match = catalog.posts
					.map((post) => ({ post, rank: matchPost(post, needle) }))
					.filter((item) => item.rank > 0)
					.sort((a, b) => b.rank - a.rank)[0];
				if (!match) return { ok: false, error: "No matching post." };
				return match.post;
			},
		},
		{
			name: "search_docs",
			description: "Search project documentation titles and snippets.",
			inputSchema: {
				type: "object",
				properties: {
					query: { type: "string", description: "Search text" },
				},
				required: ["query"],
			},
			annotations: { readOnlyHint: true },
			execute: ({ query }) => {
				const needle = String(query ?? "").trim();
				if (!needle) return { ok: false, error: "Add a search query." };
				const matches = catalog.docPages
					.map((page) => ({ page, rank: matchDoc(page, needle) }))
					.filter((item) => item.rank > 0)
					.sort((a, b) => b.rank - a.rank)
					.slice(0, 20)
					.map(({ page }) => ({
						title: page.title,
						project: page.project,
						url: page.url,
						snippet: page.snippet,
					}));
				return { query: needle, matches };
			},
		},
		{
			name: "get_doc_page",
			description: "Get one docs page by project, slug, or title.",
			inputSchema: {
				type: "object",
				properties: {
					query: { type: "string", description: "Project, slug, or page title" },
				},
				required: ["query"],
			},
			annotations: { readOnlyHint: true },
			execute: ({ query }) => {
				const needle = String(query ?? "").trim();
				if (!needle) return { ok: false, error: "Add a docs query." };
				const match = catalog.docPages
					.map((page) => ({ page, rank: matchDoc(page, needle) }))
					.filter((item) => item.rank > 0)
					.sort((a, b) => b.rank - a.rank)[0];
				if (!match) return { ok: false, error: "No matching docs page." };
				return match.page;
			},
		},
		{
			name: "list_docs",
			description: "List documentation trees on this site.",
			inputSchema: { type: "object", properties: {} },
			annotations: { readOnlyHint: true },
			execute: () => ({ docs: catalog.docs }),
		},
		{
			name: "get_resume",
			description: "Resume facts: experience, selected projects, education, skills. Not the PDF bytes.",
			inputSchema: { type: "object", properties: {} },
			annotations: { readOnlyHint: true },
			execute: () => catalog.resume,
		},
		{
			name: "list_downloads",
			description: "List software download redirects.",
			inputSchema: { type: "object", properties: {} },
			annotations: { readOnlyHint: true },
			execute: () => ({ downloads: catalog.downloads }),
		},
		{
			name: "open_tab",
			description: "Open a dashboard section: projects, resume, blog, github, leetcode, or community.",
			inputSchema: {
				type: "object",
				properties: {
					tab: {
						type: "string",
						enum: TABS.map((tab) => tab.id),
						description: "Dashboard tab id",
					},
				},
				required: ["tab"],
			},
			annotations: { readOnlyHint: false, consequentialHint: true },
			execute: ({ tab }) => {
				const id = String(tab ?? "").toLowerCase() as TabId;
				const def = TABS.find((item) => item.id === id);
				if (!def) return { ok: false, error: "Unknown tab. Use projects, resume, blog, github, leetcode, or community." };
				const button = document.querySelector<HTMLElement>(`[data-tab="${def.id}"]`);
				if (button) {
					button.click();
					return { ok: true, tab: def.id, url: def.href, switchedOnPage: true };
				}
				window.location.assign(def.href);
				return { ok: true, tab: def.id, url: def.href, switchedOnPage: false };
			},
		},
		{
			name: "get_contact",
			description: "How to reach Tashif. Does not send mail.",
			inputSchema: { type: "object", properties: {} },
			annotations: { readOnlyHint: true },
			execute: () => ({
				email: catalog.email,
				connect: `${catalog.site}/connect`,
				studio: catalog.studio,
				socials: catalog.socials,
				start_contact:
					"Use start_contact to draft a message. It opens the visitor's mail app and returns the draft for in-chat agents.",
			}),
		},
		{
			name: "copy_email",
			description: "Copy me@taf.sh to the clipboard. Does not send mail.",
			inputSchema: { type: "object", properties: {} },
			annotations: { readOnlyHint: false, consequentialHint: true },
			execute: async () => {
				const copied = await copyText(catalog.email);
				return {
					ok: true,
					email: catalog.email,
					copied,
					note: copied ? "Copied me@taf.sh." : "Clipboard blocked. Address is me@taf.sh.",
				};
			},
		},
		{
			name: "start_contact",
			description:
				"Draft a message to me@taf.sh. Fills the connect form when present, opens the visitor's mail app, and returns the full draft for in-chat agents such as Grok. Does not send until a human hits Send or the agent sends from the user's mailbox after they confirm.",
			inputSchema: {
				type: "object",
				properties: {
					name: { type: "string", description: "Visitor's name" },
					email: { type: "string", description: "Visitor's reply-to email" },
					subject: { type: "string", description: "Optional subject line" },
					message: {
						type: "string",
						description: "Message body. At least 20 characters.",
					},
				},
				required: ["name", "email", "message"],
			},
			annotations: { readOnlyHint: false, consequentialHint: true },
			execute: async ({ name, email: replyTo, subject, message }) => {
				const person = String(name ?? "").trim();
				const mail = String(replyTo ?? "").trim();
				const note = String(message ?? "").trim();
				const heading = String(subject ?? "").trim() || `Message from ${person}`;
				if (!person) return { ok: false, error: "Add a name." };
				if (!isEmail(mail)) return { ok: false, error: "That reply-to email does not look right." };
				if (note.length < 20) return { ok: false, error: "Give the message at least 20 characters." };

				const ref = `codes-${Date.now().toString(36).slice(-4)}`;
				const body = [
					`Name: ${person}`,
					`Email: ${mail}`,
					"",
					note,
					"",
					"---",
					`Sent via tashif.codes contact draft [${ref}]`,
				].join("\n");
				const filledForm = fillContactForm({
					name: person,
					email: mail,
					subject: heading,
					message: note,
				});
				const opened = openMailto(buildMailto(catalog.email, heading, body));
				return contactDraft({
					to: catalog.email,
					subject: heading,
					body,
					opened,
					filledForm,
				});
			},
		},
	];
}

let controller: AbortController | null = null;

export function abortPortfolioWebmcp() {
	controller?.abort();
	controller = null;
}

export async function registerPortfolioWebmcp(catalog: WebmcpCatalog) {
	if (!document.modelContext) return;
	abortPortfolioWebmcp();
	controller = new AbortController();
	try {
		await registerTools(tools(catalog), controller.signal);
	} catch {
		// Origin trial, Permissions-Policy, or an older polyfill. The page still works.
	}
}
