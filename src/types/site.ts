/**
 * Site-wide odds and ends: socials, downloads, live-refresh bookkeeping.
 */

export interface SocialLink {
	icon: React.ComponentType<{ className?: string; size?: number | string }>;
	link: string;
	label: string;
}

export interface DownloadProject {
  title: string;
  download_url: string;
}

export type LiveDataSource =
	| "github"
	| "leetcode"
	| "projects"
	| "project-stats"
	| "blog";

export type LiveRefreshDetail = {
	source: LiveDataSource;
	fetchedAt: string;
};
