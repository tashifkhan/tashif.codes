/**
 * The dashboard's tabs double as real routes: each one owns a URL that is
 * server-rendered with that section already open, and switching tabs in the
 * browser swaps sections + pushState's the same URL (no navigation).
 *
 * Shared by SectionTabs.astro (markup), Dashboard.astro (which section starts
 * visible) and the client-side tab script — so keep this module free of any
 * heavy imports, it ends up in the client bundle.
 */

export type TabId =
	| "projects"
	| "resume"
	| "blog"
	| "github"
	| "leetcode"
	| "community";

export interface TabDef {
	id: TabId;
	/** Canonical path this tab owns; a hard load here renders it active. */
	href: string;
	/** Tab button text */
	label: string;
	/** Document title suffix — "<titleLabel> | <owner>". Empty = home title. */
	titleLabel: string;
}

export const TABS: readonly TabDef[] = [
	{ id: "projects", href: "/", label: "Projects", titleLabel: "" },
	{ id: "resume", href: "/resume", label: "About", titleLabel: "Resume" },
	{ id: "blog", href: "/blog", label: "Blog", titleLabel: "Blog" },
	{ id: "github", href: "/github", label: "GitHub", titleLabel: "GitHub" },
	{
		id: "leetcode",
		href: "/leetcode",
		label: "LeetCode",
		titleLabel: "LeetCode",
	},
	{ id: "community", href: "/connect", label: "Connect", titleLabel: "Connect" },
];

export const TAB_IDS: readonly TabId[] = TABS.map((t) => t.id);

export const DEFAULT_TAB: TabId = "projects";

export function getTab(id: TabId): TabDef {
	return TABS.find((t) => t.id === id) ?? TABS[0];
}

/** Canonical path -> tab. Returns null for paths the dashboard doesn't own. */
export function tabFromPath(pathname: string): TabId | null {
	const path = pathname.replace(/\/+$/, "") || "/";
	return TABS.find((t) => t.href === path)?.id ?? null;
}

/**
 * Legacy deep links: /?blog, /?about, /?connect, /?tab=github (plus the
 * long-standing "gtihub" typo). Kept working so old links don't rot — the
 * client rewrites them to the canonical path on load.
 */
const QUERY_ALIASES: Record<string, TabId> = {
	projects: "projects",
	blog: "blog",
	github: "github",
	gtihub: "github",
	leetcode: "leetcode",
	about: "resume",
	resume: "resume",
	connect: "community",
	community: "community",
};

export function tabFromSearch(search: string): TabId | null {
	const params = new URLSearchParams(search);

	for (const [alias, id] of Object.entries(QUERY_ALIASES)) {
		if (params.has(alias)) return id;
	}

	const tab = (params.get("tab") || "").toLowerCase();
	return QUERY_ALIASES[tab] ?? null;
}

/**
 * Drop the tab-selecting params from a query string, keeping everything else
 * (utm_*, ref, …) so canonicalising a legacy link doesn't lose attribution.
 * Returns "" or a leading-"?" string.
 */
export function stripTabParams(search: string): string {
	const params = new URLSearchParams(search);
	for (const alias of Object.keys(QUERY_ALIASES)) params.delete(alias);
	params.delete("tab");
	const rest = params.toString();
	return rest ? `?${rest}` : "";
}
