// Fallback card copy for docs trees whose repo is missing from the cached
// GitHub project list. Keyed by lowercase docs directory name.
export const DOCS_CARD_COPY: Record<
	string,
	{
		title: string
		description: string
		languages: string[]
		github?: string
	}
> = {
	talentsync: {
		title: "TalentSync",
		description:
			"AI resume builder and ATS optimizer for job seekers. Tailored resumes, outreach, and interview prep from one profile.",
		languages: ["TypeScript", "Python"],
	},
	"talentsync-hr": {
		title: "TalentSync HR",
		description:
			"Recruiter screening: JD and resume parsing, claim validation, ranking, and reports. Separate from the job-seeker app.",
		languages: ["TypeScript", "Python"],
	},
	"github-stats-api": {
		title: "GitHub stats API",
		description:
			"Public GitHub username to stats, own-commit languages, PRs, and an SVG card. Redis-backed attribution walk.",
		languages: ["Python"],
		github: "https://github.com/tashifkhan/GitHub-Stats-API",
	},
	"leetcode-stats-api": {
		title: "LeetCode stats API",
		description:
			"LeetCode GraphQL proxy: envelope, year-by-year heatmap, SVG card. Same family as the other stats APIs.",
		languages: ["Python"],
		github: "https://github.com/tashifkhan/LeetCodeStatsAPI",
	},
	"gfg-stats-api": {
		title: "GFG stats API",
		description:
			"GeeksForGeeks profile, difficulty split, coding score, and heatmap via the current GFG JSON endpoints.",
		languages: ["Python"],
		github: "https://github.com/tashifkhan/GFG-Stats-API",
	},
	"codechef-stats-api": {
		title: "CodeChef stats API",
		description:
			"Public CodeChef handle to rating, stars, contest history, and heatmap. Scraped into the shared envelope.",
		languages: ["Python"],
		github: "https://github.com/tashifkhan/codechef-stats-api",
	},
	"codeforces-stats-api": {
		title: "Codeforces stats API",
		description:
			"Official Codeforces API wrapper: rating, contests, heatmap, plus multi-handle and upcoming-contest helpers.",
		languages: ["Python"],
		github: "https://github.com/tashifkhan/CodeForces-API",
	},
	"hackerrank-stats-api": {
		title: "HackerRank stats API",
		description:
			"Public HackerRank profile, practice score, badges, and whatever submission history upstream actually returns.",
		languages: ["Python"],
		github: "https://github.com/tashifkhan/hackerrank-api",
	},
	"tuf-stats-api": {
		title: "TUF stats API",
		description:
			"takeUforward DSA sheet totals, topics, and heatmap from 2023 onward.",
		languages: ["Python"],
		github: "https://github.com/tashifkhan/TUF-Stats-API",
	},
	"githost-stats-api": {
		title: "GitHost stats API",
		description:
			"Forgejo, Gitea, Codeberg, or any Gitea-compatible host. Same envelope as GitHub stats, plus instance targeting.",
		languages: ["Python"],
		github: "https://github.com/tashifkhan/GitHost-Stats-API",
	},
	codetrace: {
		title: "CodeTrace",
		description:
			"Stacked coding-profile dashboard over the stats APIs. How the seven cards merge, plus the RCEE copy story.",
		languages: ["TypeScript", "Python"],
		github: "https://github.com/tashifkhan/stats-api-demo",
	},
};
