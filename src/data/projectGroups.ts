import { slugify } from "../lib/slugify";
import type { Project, StarList } from "@/types";

/**
 * How the projects page groups repos. Membership lives on GitHub, so adding or
 * moving a repo never touches this file:
 *
 * - Featured: profile pins in the order set on GitHub, then any repo with the
 *   `featured` topic.
 * - Sections: a star list, or a set of ordinary-looking repo topics. A repo can
 *   sit in several sections and in Featured at once.
 * - Hidden: repos with a HIDE_TOPICS topic are dropped from the site.
 * - Leftovers go to "More projects", or to Forks and Archive by GitHub's flags.
 *
 * Edit this file only to add, rename or reorder a section.
 */

export const FEATURED_TOPIC = "featured";
export const HIDE_TOPICS = ["config", "dotfiles"];
export const WIP_TOPICS = ["work-in-progress", "wip"];

export interface SectionRule {
	id: string;
	title: string;
	/** Collapsed sections render below "More projects". */
	open: boolean;
	/** Match repos in this GitHub star list, by list name. */
	starList?: string;
	/** Match repos carrying any of these topics. */
	topics?: string[];
}

export const SECTIONS: SectionRule[] = [
	{ id: "ai-products", title: "AI products", open: true, topics: ["ai-product"] },
	{ id: "mobile-apps", title: "Mobile apps", open: true, topics: ["mobile-app"] },
	{ id: "self-hosting", title: "Self-hosting", open: true, topics: ["self-hosted", "self-hosting"] },
	{ id: "stats-apis", title: "Coding Profile Stats APIs", open: true, starList: "Coding Profile Stats APIs" },
	{ id: "jiit-tools", title: "JIIT Tool Suite", open: true, starList: "JIIT Tool Suite" },
	{ id: "wip", title: "Work in progress", open: false, topics: WIP_TOPICS },
	{ id: "websites", title: "Simple websites", open: false, topics: ["website", "landing-page"] },
	{ id: "scripts", title: "Scripts", open: false, topics: ["script", "scripts"] },
	{ id: "themes", title: "Themes", open: false, topics: ["theme", "jellyfin-theme", "vscode-theme", "zed-theme"] },
	{ id: "assignments", title: "Assignments", open: false, topics: ["assignment", "coursework"] },
];

export const hasTopic = (project: Project, topics: readonly string[]): boolean =>
	(project.topics ?? []).some((t) => topics.includes(t.toLowerCase()));

/** Slugs of every repo in each star list, keyed by list name. */
export function starListSlugs(lists: StarList[]): Map<string, Set<string>> {
	return new Map(
		lists.map((list) => [
			list.name,
			new Set((list.repositories ?? []).map((full) => slugify(full.split("/").pop() ?? ""))),
		])
	);
}

export interface ProjectSection {
	id: string;
	title: string;
	open: boolean;
	projects: Project[];
}

export interface ProjectLayout {
	featured: Project[];
	/** Rule-based sections that matched at least one repo, in SECTIONS order. */
	sections: ProjectSection[];
	more: Project[];
	forks: Project[];
	archive: Project[];
}

/**
 * Split projects into page sections. `projects` must already be in display
 * order (featured by pin rank, the rest by stars); each section keeps that
 * order but moves repeats of Featured to the end, so the cards shown before
 * "Show more" are new to the reader.
 */
export function layoutProjects(projects: Project[], lists: StarList[]): ProjectLayout {
	const listSlugs = starListSlugs(lists);
	const featured = projects.filter((p) => p.pinned);
	const grouped = new Set<string>();

	const sections = SECTIONS.map((rule) => {
		const inList = rule.starList ? listSlugs.get(rule.starList) : undefined;
		const matches = projects.filter(
			(p) => (inList?.has(p.slug) ?? false) || (rule.topics ? hasTopic(p, rule.topics) : false)
		);
		matches.forEach((p) => grouped.add(p.slug));
		const fresh = matches.filter((p) => !p.pinned);
		return { id: rule.id, title: rule.title, open: rule.open, projects: [...fresh, ...matches.filter((p) => p.pinned)] };
	}).filter((s) => s.projects.length > 0);

	const rest = projects.filter((p) => !p.pinned && !grouped.has(p.slug));
	return {
		featured,
		sections,
		more: rest.filter((p) => !p.archived && !p.isFork),
		forks: rest.filter((p) => !p.archived && p.isFork),
		archive: rest.filter((p) => p.archived),
	};
}
