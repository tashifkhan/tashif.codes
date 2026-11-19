// Fetches the list of projects with analytics at build time
import { createCachedFetch } from "../lib/fetchCached";
import type { AnalyticsProject, AnalyticsProjectsResponse } from "@/types";

const { fetchJson } = createCachedFetch("analytics");


let cachedProjects: AnalyticsProject[] | null = null;
const API_PREFIX = "/projects/stats/api";

export async function fetchAnalyticsProjects(): Promise<AnalyticsProject[]> {
	if (cachedProjects) return cachedProjects;

	const siteBase = (import.meta.env.SITE || "https://tashif.codes").replace(/\/+$/, "");
	const configuredBase = (import.meta.env.PUBLIC_API_BASE || "").trim().replace(/\/+$/, "");
	const apiBase = configuredBase
		? configuredBase.endsWith(API_PREFIX)
			? configuredBase
			: `${configuredBase}${API_PREFIX}`
		: `${siteBase}${API_PREFIX}`;

	// This endpoint is served by the site's own Python function, so during a
	// cold deploy it can be unreachable from the build. The disk cache is what
	// keeps the analytics tabs from vanishing when that happens.
	const data = await fetchJson<AnalyticsProjectsResponse>(
		`${apiBase}/v1/projects`,
		"v1-projects",
	);

	const projects = Array.isArray(data?.projects) ? data.projects : [];
	cachedProjects = projects;
	return projects;
}

// Map project slugs to their analytics slugs (for renamed projects)
const slugMapping: Record<string, string> = {
	"jiit-placement-alerts": "jiit-campus-updates",
    "jiit-time-table-website": "jiit-timetable-website",
    "JIIT-Academic-Calender": "jiit-timetable-website",
    "JIIT-time-table-parser": "jiit-timetable-website",
    "TalentSync-HR-Dashboard": "talentsync",
    // The seven stats APIs share one view of their request history.
    "github-stats-api": "stats-apis",
    "leetcode-stats-api": "stats-apis",
    "codeforces-api": "stats-apis",
    "gfg-stats-api": "stats-apis",
    "codechef-stats-api": "stats-apis",
    "hackerrank-stats-api": "stats-apis",
    "tuf-stats-api": "stats-apis",
    // The metro apps' cards open their API's request history.
    "delhi-metro": "delhi-metro-api",
    "blr-metro": "blr-metro-api",
};

export function getAnalyticsSlug(slug: string): string {
	return slugMapping[slug.toLowerCase()] || slug;
}

export function hasAnalytics(slug: string, analyticsProjects: AnalyticsProject[]): boolean {
	const normalizedSlug = getAnalyticsSlug(slug);
	return analyticsProjects.some((p) => p.slug.toLowerCase() === normalizedSlug.toLowerCase());
}
