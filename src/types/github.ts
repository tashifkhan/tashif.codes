/**
 * GitHub stats, contributions, and starred-repository shapes.
 *
 * Mirrors the payloads returned by github-stats.tashif.codes.
 */

export interface TopLanguage {
	name: string;
	percentage: number;
	color: string;
}

export interface YearlyContributions {
	[date: string]: number;
}

export interface GitHubStatsData {
	status: string;
	message: string;
	topLanguages: TopLanguage[];
	totalCommits: number;
	longestStreak: number;
	currentStreak: number;
	profile_visitors: number;
	contributions: {
		[year: string]: YearlyContributions;
	};
}

export interface PullRequest {
	repo: string;
	number: number;
	title: string;
	state: string;
	created_at: string;
	updated_at: string;
	closed_at: string | null;
	merged_at: string | null;
	user: string;
	url: string;
	body: string | null;
}

export interface StarredRepository {
	name: string;
	description: string | null;
	language: string | null;
	stars: number;
	forks: number;
	url: string;
}

export interface StarsData {
	total_stars: number;
	repositories: StarredRepository[];
}

export interface Commit {
	repo: string;
	message: string;
	timestamp: string;
	sha: string;
	url: string;
}

export interface Pull {
	repo: string;
	number: number;
	title: string;
	state: string;
	created_at: string;
	updated_at: string;
	closed_at: string | null;
	merged_at: string | null;
	user: string;
	url: string;
	body: string | null;
}

export interface OrgContribution {
	org: string;
	org_id: number;
	org_url: string;
	org_avatar_url: string;
	repos: string[];
}

export interface GitHubStats {
	stats: GitHubStatsData;
	prs: PullRequest[];
	stars: StarsData;
	commits: Commit[];
	pulls: Pull[];
	orgContributions: OrgContribution[];
}

export interface StarList {
  name: string;
  url: string;
  repositories?: string[]; // owner/repo slugs
  description?: string;
  num_repos?: number;
}
