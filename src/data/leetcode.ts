import { createCachedFetch } from "../lib/fetchCached";
import type { Badge, Contest, LeetCodeData, LeetCodeProfile, LeetCodeStats } from "@/types";


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
		fetchJson<Contest[]>(`${base}/contests`, `${user}-contests`),
		fetchJson<Badge[]>(`${base}/badges`, `${user}-badges`),
		fetchJson<LeetCodeProfile>(`${base}/profile`, `${user}-profile`),
	]);

	return {
		stats: stats ?? EMPTY_STATS,
		contests: Array.isArray(contests) ? contests : [],
		badges: Array.isArray(badges) ? badges : [],
		profile: profile ?? EMPTY_PROFILE,
	};
}

export const leetCodeData: LeetCodeData = await fetchLeetCodeData();

/** ISO timestamp when LeetCode data was last fetched (build / server). */
export const leetCodeFetchedAt: string = new Date().toISOString();