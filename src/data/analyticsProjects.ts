// Fetches the list of projects with analytics at build time
export interface AnalyticsProject {
	slug: string;
	name: string;
}

export interface AnalyticsProjectsResponse {
	projects: AnalyticsProject[];
	total: number;
}

let cachedProjects: AnalyticsProject[] | null = null;
const API_PREFIX = "/projects/stats/api";

export async function fetchAnalyticsProjects(): Promise<AnalyticsProject[]> {
	if (cachedProjects) return cachedProjects;

	try {
		const siteBase = (import.meta.env.SITE || "https://tashif.codes").replace(/\/+$/, "");
		const configuredBase = (import.meta.env.PUBLIC_API_BASE || "").trim().replace(/\/+$/, "");
		const apiBase = configuredBase
			? configuredBase.endsWith(API_PREFIX)
				? configuredBase
				: `${configuredBase}${API_PREFIX}`
			: `${siteBase}${API_PREFIX}`;

		const res = await fetch(`${apiBase}/v1/projects`);
		if (!res.ok) {
			console.error("Failed to fetch analytics projects:", res.status, res.statusText);
			return [];
		}
		const data: AnalyticsProjectsResponse = await res.json();
		cachedProjects = data.projects;
		return data.projects;
	} catch (e) {
		console.error("Error fetching analytics projects:", e);
		return [];
	}
}

// Map project slugs to their analytics slugs (for renamed projects)
const slugMapping: Record<string, string> = {
	"jiit-placement-alerts": "jiit-campus-updates",
    "jiit-time-table-website": "jiit-timetable-website",
    "JIIT-Academic-Calender": "jiit-timetable-website",
    "JIIT-time-table-parser": "jiit-timetable-website",
    "TalentSync-HR-Dashboard": "talentsync",
};

export function getAnalyticsSlug(slug: string): string {
	return slugMapping[slug.toLowerCase()] || slug;
}

export function hasAnalytics(slug: string, analyticsProjects: AnalyticsProject[]): boolean {
	const normalizedSlug = getAnalyticsSlug(slug);
	return analyticsProjects.some((p) => p.slug.toLowerCase() === normalizedSlug.toLowerCase());
}
