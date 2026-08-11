import {
	githubAttributedStatsUrl,
	githubUsernames,
	personalGithubUsername,
} from "./profile";

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

type UserResults = {
	username: string;
	results: [any, any, any, any, any, any];
};

const emptyStats = (): GitHubStats => ({
	stats: {
		status: "",
		message: "",
		topLanguages: [],
		totalCommits: 0,
		longestStreak: 0,
		currentStreak: 0,
		profile_visitors: 0,
		contributions: {},
	},
	prs: [],
	stars: { total_stars: 0, repositories: [] },
	commits: [],
	pulls: [],
	orgContributions: [],
});

async function fetchExtraParentStars(): Promise<number> {
	const mappings = [
		{ user: "codeblech", repos: ["jsjiit", "jportal"] },
		{ user: "codelif", repos: ["pyjiit"] },
	];

	let totalExtraStars = 0;

	await Promise.all(
		mappings.map(async ({ user, repos }) => {
			try {
				const res = await fetch(
					`https://github-stats.tashif.codes/${user}/stars`
				);
				if (res.ok) {
					const data = await res.json();
					if (data.repositories && Array.isArray(data.repositories)) {
						data.repositories.forEach((repo: any) => {
							if (repos.includes(repo.name.toLowerCase())) {
								totalExtraStars += repo.stars;
							}
						});
					}
				}
			} catch (e) {
				console.error(`Error fetching extra stars for ${user}:`, e);
			}
		})
	);

	return totalExtraStars;
}

async function fetchUserResults(username: string): Promise<UserResults> {
	const endpoints = [
		githubAttributedStatsUrl("https://github-stats.tashif.codes", username),
		`https://github-stats.tashif.codes/${username}/prs`,
		`https://github-stats.tashif.codes/${username}/stars`,
		`https://github-stats.tashif.codes/${username}/commits`,
		`https://github-stats.tashif.codes/${username}/me/pulls`,
		`https://github-stats.tashif.codes/${username}/org-contributions`,
	];

	const responses = await Promise.all(endpoints.map((endpoint) => fetch(endpoint)));

	const results = await Promise.all(
		responses.map((response) => {
			if (!response.ok) {
				console.error(
					`Failed to fetch from ${response.url}:`,
					response.statusText
				);
				return null;
			}
			return response.json();
		})
	);

	return { username, results: results as UserResults["results"] };
}

function aggregateUserResults(
	allResponses: UserResults[],
	extraStars: number
): GitHubStats {
	const aggStats: GitHubStatsData = {
		status: "success",
		message: "",
		topLanguages: [],
		totalCommits: 0,
		longestStreak: 0,
		currentStreak: 0,
		profile_visitors: 0,
		contributions: {},
	};
	let aggPrs: PullRequest[] = [];
	let aggStars: StarsData = { total_stars: 0, repositories: [] };
	let aggCommits: Commit[] = [];
	let aggPulls: Pull[] = [];
	let aggOrgContributions: OrgContribution[] = [];

	allResponses.forEach(({ results }) => {
		const [stats, prs, stars, commits, pulls, orgContributions] = results;

		if (stats) {
			aggStats.totalCommits += stats.totalCommits || 0;
			aggStats.longestStreak = Math.max(
				aggStats.longestStreak,
				stats.longestStreak || 0
			);
			aggStats.currentStreak = Math.max(
				aggStats.currentStreak,
				stats.currentStreak || 0
			);

			// Prefer languages from the personal account when present; otherwise first non-empty
			if (aggStats.topLanguages.length === 0 && stats.topLanguages) {
				aggStats.topLanguages = stats.topLanguages;
			}

			if (stats.contributions) {
				Object.entries(stats.contributions).forEach(
					([year, yearlyData]: [string, any]) => {
						if (!aggStats.contributions[year])
							aggStats.contributions[year] = {};
						Object.entries(yearlyData).forEach(
							([date, count]: [string, any]) => {
								aggStats.contributions[year][date] =
									(aggStats.contributions[year][date] || 0) +
									(count as number);
							}
						);
					}
				);
			}
		}

		if (prs) aggPrs.push(...prs);

		if (stars) {
			aggStars.total_stars += stars.total_stars || 0;
			if (stars.repositories) aggStars.repositories.push(...stars.repositories);
		}

		if (commits) aggCommits.push(...commits);
		if (pulls) aggPulls.push(...pulls);
		if (orgContributions) aggOrgContributions.push(...orgContributions);
	});

	const uniquePrs = Array.from(
		new Map(aggPrs.map((pr) => [pr.url, pr])).values()
	);
	const uniqueStars = Array.from(
		new Map(aggStars.repositories.map((repo) => [repo.url, repo])).values()
	);
	const uniqueCommits = Array.from(
		new Map(aggCommits.map((c) => [c.sha, c])).values()
	);
	const uniquePulls = Array.from(
		new Map(aggPulls.map((p) => [p.url, p])).values()
	);
	const uniqueOrgs = Array.from(
		new Map(aggOrgContributions.map((o) => [o.org_id, o])).values()
	);

	return {
		stats: aggStats,
		prs: uniquePrs,
		stars: {
			total_stars: aggStars.total_stars + extraStars,
			repositories: uniqueStars,
		},
		commits: uniqueCommits,
		pulls: uniquePulls,
		orgContributions: uniqueOrgs,
	};
}

async function fetchViewsFor(usernames: string[]): Promise<number> {
	let totalViews = 0;

	for (const username of usernames) {
		try {
			const viewsResponse = await fetch(
				`https://komarev.com/ghpvc/?username=${username}&style=for-the-badge&color=orange`
			);
			if (viewsResponse.ok) {
				const viewsData = await viewsResponse.text();
				const titleMatch = viewsData.match(/<title>(.*?)<\/title>/);
				const matches = titleMatch
					? titleMatch[1].match(/(\d[\d,]*)/)
					: null;
				if (matches && matches[0]) {
					totalViews += parseInt(matches[0].replace(/,/g, ""), 10);
				}
			}
		} catch (e) {
			console.error(`Failed to fetch views for ${username}:`, e);
		}
	}

	return totalViews;
}

function withViews(stats: GitHubStats, views: number): GitHubStats {
	return {
		...stats,
		stats: {
			...stats.stats,
			profile_visitors: views,
		},
	};
}

async function fetchDualGitHubStats(): Promise<{
	all: GitHubStats;
	personal: GitHubStats;
}> {
	try {
		const extraStarsPromise = fetchExtraParentStars();
		const viewsAllPromise = fetchViewsFor(githubUsernames);
		const viewsPersonalPromise = fetchViewsFor([personalGithubUsername]);

		const allResponses = await Promise.all(
			githubUsernames.map((username) => fetchUserResults(username))
		);

		const extraStars = await extraStarsPromise;
		const personalResponses = allResponses.filter(
			(r) => r.username === personalGithubUsername
		);

		// Prefer personal account languages when aggregating all accounts
		const personalFirst = [
			...personalResponses,
			...allResponses.filter((r) => r.username !== personalGithubUsername),
		];

		const all = withViews(
			aggregateUserResults(personalFirst, extraStars),
			await viewsAllPromise
		);
		const personal = withViews(
			aggregateUserResults(personalResponses, extraStars),
			await viewsPersonalPromise
		);

		return { all, personal };
	} catch (error) {
		console.error("Error fetching GitHub stats:", error);
		return { all: emptyStats(), personal: emptyStats() };
	}
}

const dual = await fetchDualGitHubStats();

/** Aggregated stats across personal + work accounts (default view). */
export const githubStats: GitHubStats = dual.all;

/** Stats for the personal account only (tashifkhan). */
export const githubStatsPersonal: GitHubStats = dual.personal;

/** ISO timestamp when GitHub data was last fetched (build / server). */
export const githubFetchedAt: string = new Date().toISOString();
