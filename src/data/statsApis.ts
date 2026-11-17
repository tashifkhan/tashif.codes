/**
 * The coding-profile stats APIs. One entry per API, used by each API's
 * landing and by the CodeTrace landing. Endpoints are the ones each README
 * documents.
 */
export interface StatsApi {
	/** Project slug, and the file name under src/landings. */
	slug: string;
	/** The platform it reads, e.g. "LeetCode". */
	platform: string;
	host: string;
	/** A real handle to show in the sample call. */
	sample: string;
	/** What the placeholder in the path is called. */
	param: string;
	/** One sentence on what is specific to this API. */
	angle: string;
	endpoints: { path: string; body: string }[];
}

const u = (path: string, body: string) => ({ path, body });

export const statsApis: StatsApi[] = [
	{
		slug: "github-stats-api",
		platform: "GitHub",
		host: "github-stats.tashif.codes",
		sample: "tashifkhan",
		param: "username",
		angle:
			"It goes past the profile numbers into commits, languages by bytes, star lists and releases.",
		endpoints: [
			u("/{username}/stats", "Totals: commits, pull requests, stars and streaks."),
			u("/{username}/languages", "Languages across repositories."),
			u("/{username}/contributions", "The contribution calendar."),
			u("/{username}/contributions/breakdown", "Contributions split by kind."),
			u("/{username}/repos", "Repositories with stars, forks and topics."),
			u("/{username}/commits", "Recent commits."),
			u("/{username}/stars", "Starred repositories."),
			u("/{username}/star-lists", "Star lists and what is in them."),
			u("/{owner}/repos/{repo}/releases", "Releases and their assets for one repository."),
			u("/{username}/profile-views", "A profile view counter."),
		],
	},
	{
		slug: "leetcode-stats-api",
		platform: "LeetCode",
		host: "leetcode-stats.tashif.codes",
		sample: "khan-tashif",
		param: "username",
		angle: "Solved counts by difficulty, contest history and the submission heatmap.",
		endpoints: [
			u("/{username}", "Solved counts by difficulty, ranking and acceptance."),
			u("/{username}/profile", "The public profile."),
			u("/{username}/contests", "Contest history and rating."),
			u("/{username}/heatmap", "Daily submissions."),
			u("/{username}/badges", "Badges earned."),
		],
	},
	{
		slug: "codeforces-api",
		platform: "Codeforces",
		host: "codeforces-stats.tashif.codes",
		sample: "tourist",
		param: "userid",
		angle: "It can compare several handles in one call and find the contests they share.",
		endpoints: [
			u("/{userid}", "Rating, rank and solved counts."),
			u("/{userid}/basic", "The short version."),
			u("/{userid}/rating", "Rating history."),
			u("/{userid}/solved", "Solved problems."),
			u("/{userid}/contests", "Contests taken."),
			u("/{userid}/heatmap", "Daily submissions."),
			u("/multi/{userids}", "Several handles at once."),
			u("/users/common-contests/{userids}", "Contests a set of handles all took."),
		],
	},
	{
		slug: "gfg-stats-api",
		platform: "GeeksforGeeks",
		host: "gfg-stats.tashif.codes",
		sample: "tashifkhan",
		param: "username",
		angle: "Coding score, solved problems by difficulty, and a lookup for a single problem.",
		endpoints: [
			u("/{username}", "Coding score and solved counts."),
			u("/{username}/profile", "The public profile."),
			u("/{username}/solved-problems", "Solved problems by difficulty."),
			u("/problems/{slug}", "One problem by its slug."),
		],
	},
	{
		slug: "codechef-stats-api",
		platform: "CodeChef",
		host: "codechef-stats.tashif.codes",
		sample: "tourist",
		param: "handle",
		angle: "CodeChef has no public API, so this one reads the public profile page.",
		endpoints: [
			u("/profile/{handle}", "Rating, stars and rank."),
			u("/rating/{handle}", "Rating history."),
			u("/heatmap/{handle}", "Daily submissions."),
		],
	},
	{
		slug: "hackerrank-stats-api",
		platform: "HackerRank",
		host: "hackerrank-stats.tashif.codes",
		sample: "tashifkhan",
		param: "username",
		angle: "Badges, contest history and the submission heatmap for a public profile.",
		endpoints: [
			u("/{username}", "Summary stats."),
			u("/{username}/profile", "The public profile."),
			u("/{username}/badges", "Badges and their levels."),
			u("/{username}/contests", "Contest history."),
			u("/{username}/heatmap", "Daily submissions."),
		],
	},
	{
		slug: "tuf-stats-api",
		platform: "takeUforward",
		host: "tuf-stats.tashif.codes",
		sample: "tashifkhan",
		param: "username",
		angle: "DSA sheet progress next to the usual profile, rating and heatmap.",
		endpoints: [
			u("/{username}", "Summary stats."),
			u("/{username}/profile", "The public profile."),
			u("/{username}/stats", "Solved counts."),
			u("/{username}/rating", "Rating history."),
			u("/{username}/contests", "Contests taken."),
			u("/{username}/heatmap", "Daily submissions."),
			u("/{username}/badges", "Badges earned."),
			u("/api/v1/progress/dsa/{username}", "Progress through the DSA sheets."),
		],
	},
];

/** Path of a sample call with the placeholder filled in. */
export function samplePath(api: StatsApi): string {
	return api.endpoints[0].path.replace(/\{[a-z_]+\}/, api.sample);
}
