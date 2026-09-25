import { allProjects } from "../data/projects";
import { DOCS_CARD_COPY } from "../data/docsCopy";
import { formatTitle } from "./formatTitle";
import {
	getSidebar,
	getProjects,
	getProjectEntry,
	sentenceCaseDocTitle,
} from "./docs";
import type { SidebarItem } from "@/types";

// Count unique doc pages in a sidebar tree (group headers may reuse a
// child's slug, so count distinct slugs rather than nodes)
function countPages(items: SidebarItem[]): number {
	const slugs = new Set<string>();
	const walk = (arr: SidebarItem[]) => {
		for (const item of arr) {
			if (item.slug !== "#") slugs.add(item.slug);
			if (item.children) walk(item.children);
		}
	};
	walk(items);
	return slugs.size;
}

const projectsBySlug = new Map(
	allProjects.map((p) => [p.slug.toLowerCase(), p]),
);

// GitHub project cards miss docs trees that are not in the cached repo list
// (TalentSync-HR) or whose slug never got a docs_slug. Walk src/data/docs.
export const getDocProjects = () =>
	getProjects()
	.map((dir) => {
		const key = dir.toLowerCase();
		const fromGh = projectsBySlug.get(key);
		const docsSlug = fromGh?.docs_slug || getProjectEntry(dir);
		if (!docsSlug) return null;
		const copy = DOCS_CARD_COPY[key];
		return {
			key,
			title: copy?.title || fromGh?.title || sentenceCaseDocTitle(formatTitle(dir)),
			description:
				copy?.description || fromGh?.description || "Project documentation.",
			languages: fromGh?.languages?.length
				? fromGh.languages
				: copy?.languages || [],
			docs_slug: docsSlug,
			pageCount: countPages(getSidebar(key)),
		};
	})
	.filter((p): p is NonNullable<typeof p> => p !== null);
