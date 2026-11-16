import { createCachedFetch } from "../lib/fetchCached";
import type {
	Badge,
	Contest,
	ContestSummary,
	LeetCodeData,
	LeetCodeProfile,
	LeetCodeStats,
	RecentSubmission,
} from "@/types";


const EMPTY_STATS: LeetCodeStats = {
	totalSolved: 0,
	totalQuestions: 0,
	easySolved: 0,
	totalEasy: 0,
	mediumSolved: 0,
	totalMedium: 0,
	hardSolved: 0,
	totalHard: 0,
	ranking: 0,
	contributionPoints: 0,
	reputation: 0,
	submissionCalendar: {},
};

const EMPTY_PROFILE: LeetCodeProfile = {
	username: "",
	realName: "",
	countryName: "",
	company: "",
	school: "",
	skillTags: [],
	starRating: 0,
	aboutMe: "",
	userAvatar: "",
	reputation: 0,
	ranking: 0,
	contributionPoints: 0,
	submissionCalendar: {},
};

const { fetchJson } = createCachedFetch("leetcode");

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

/**
 * `/contests` returns an envelope: `contestHistory` holds every contest in
 * the calendar, attended or not, oldest first. Keep the attended ones, newest
 * first.
 */
function toContests(res: any): Contest[] {
	const history = Array.isArray(res?.contestHistory) ? res.contestHistory : [];
	return history
		.filter((c: any) => c?.attended)
		.map(
			(c: any): Contest => ({
				title: String(c.contest?.title ?? "Contest"),
				startTime: num(c.contest?.startTime),
				rating: num(c.rating),
				ranking: num(c.ranking),
				problemsSolved: num(c.problemsSolved),
				totalProblems: num(c.totalProblems),
				trend: c.trendDirection === "UP" || c.trendDirection === "DOWN" ? c.trendDirection : null,
			})
		)
		.sort((a: Contest, b: Contest) => b.startTime - a.startTime);
}

function toContestSummary(res: any): ContestSummary | null {
	const attended = num(res?.attendedContestsCount ?? res?.data?.count);
	if (!attended) return null;
	return {
		attended,
		rating: num(res.rating ?? res.data?.rating),
		maxRating: num(res.data?.maxRating ?? res.rating),
		globalRanking: num(res.globalRanking ?? res.data?.globalRanking),
		totalParticipants: num(res.totalParticipants),
		topPercentage: num(res.topPercentage ?? res.data?.topPercentage),
	};
}

/** `/badges` returns `{ badges: [...] }`; older payloads were a bare array. */
function toBadges(res: any): Badge[] {
	const list = Array.isArray(res) ? res : Array.isArray(res?.badges) ? res.badges : [];
	return list.map(
		(b: any, i: number): Badge => ({
			id: String(b.id ?? b.name ?? i),
			displayName: String(b.displayName ?? b.name ?? "Badge"),
			icon: String(b.icon ?? ""),
			createdDate: String(b.creationDate ?? b.createdDate ?? ""),
		})
	);
}

/** Recent submissions from `/profile`, newest first, one row per problem. */
function toRecentSubmissions(res: any): RecentSubmission[] {
	const list = Array.isArray(res?.recentSubmissions) ? res.recentSubmissions : [];
	const seen = new Set<string>();
	const out: RecentSubmission[] = [];
	for (const r of list) {
		const slug = String(r?.titleSlug ?? "");
		if (!slug || seen.has(slug)) continue;
		seen.add(slug);
		out.push({
			title: String(r.title ?? slug),
			titleSlug: slug,
			timestamp: num(r.timestamp),
			status: String(r.statusDisplay ?? ""),
			lang: String(r.lang ?? ""),
		});
	}
	return out.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Each endpoint is fetched and cached independently, so a single failing one
 * (contests is the flakiest) degrades that panel alone instead of zeroing the
 * whole LeetCode section.
 */
async function fetchLeetCodeData(): Promise<LeetCodeData> {
	const user = "khan-tashif";
	const base = `https://leetcode-stats.tashif.codes/${user}`;

	const [stats, contests, badges, profile] = await Promise.all([
		fetchJson<LeetCodeStats>(base, `${user}-stats`),
		fetchJson<any>(`${base}/contests`, `${user}-contests`),
		fetchJson<any>(`${base}/badges`, `${user}-badges`),
		fetchJson<any>(`${base}/profile`, `${user}-profile`),
	]);

	return {
		stats: stats ?? EMPTY_STATS,
		contests: toContests(contests),
		contestSummary: toContestSummary(contests),
		badges: toBadges(badges),
		recentSubmissions: toRecentSubmissions(profile),
		profile: (profile as LeetCodeProfile) ?? EMPTY_PROFILE,
	};
}

export const leetCodeData: LeetCodeData = await fetchLeetCodeData();

/** ISO timestamp when LeetCode data was last fetched (build / server). */
export const leetCodeFetchedAt: string = new Date().toISOString();