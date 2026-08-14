/**
 * Every shared shape in the app, in one place.
 *
 * Types used to live next to whichever module happened to fetch them first,
 * so a component that needed `Project` had to import it from the module that
 * also performs network I/O at import time. Splitting them out means a
 * component can describe its props without pulling a fetcher into its graph.
 *
 * Import from the barrel — `import type { Project } from "@/types"` — unless
 * you have a reason to reach for a specific domain file.
 *
 * Ambient module declarations (html2pdf, prismjs) stay as `.d.ts` siblings and
 * are picked up by tsconfig automatically; they are not re-exported here.
 */

export type {
	TopLanguage,
	YearlyContributions,
	GitHubStatsData,
	PullRequest,
	StarredRepository,
	StarsData,
	Commit,
	Pull,
	OrgContribution,
	GitHubStats,
	StarList,
} from "./github";

export type {
	LeetCodeStats,
	Contest,
	Badge,
	LeetCodeProfile,
	LeetCodeData,
} from "./leetcode";

export type {
	BlogPost,
	BlogComment,
	BlogMetrics,
	BlogHeading,
	BlogOutline,
	FullBlogPost,
} from "./blog";

export type {
	ReleaseAsset,
	RepoRelease,
	Project,
	Contributor,
	AnalyticsProject,
	AnalyticsProjectsResponse,
} from "./projects";

export type {
	ResumeProject,
	Education,
	Position,
	SkillCategory,
	ResumeAction,
	ExperienceEntry,
} from "./resume";

export type { DocPage, SidebarItem } from "./docs";

export type {
	SocialLink,
	DownloadProject,
	LiveDataSource,
	LiveRefreshDetail,
} from "./site";
