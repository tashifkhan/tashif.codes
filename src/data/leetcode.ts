export interface LeetCodeStats {
	totalSolved: number;
	totalQuestions: number;
	easySolved: number;
	totalEasy: number;
	mediumSolved: number;
	totalMedium: number;
	hardSolved: number;
	totalHard: number;
	ranking: number;
	contributionPoints: number;
	reputation: number;
	submissionCalendar: {
		[date: string]: number;
	};
}

export interface Contest {
	title: string;
	startTime: number;
	duration: number;
	participants: number;
	rank: number;
	score: number;
	ratingChange: number;
	problemsSolved: number;
}

export interface Badge {
	id: string;
	displayName: string;
	icon: string;
	createdDate: string;
	description: string;
}

export interface LeetCodeProfile {
	username: string;
	realName: string;
	countryName: string;
	company: string;
	school: string;
	skillTags: string[];
	starRating: number;
	aboutMe: string;
	userAvatar: string;
	reputation: number;
	ranking: number;
	contributionPoints: number;
	submissionCalendar: {
		[date: string]: number;
	};
}

export interface LeetCodeData {
	stats: LeetCodeStats;
	contests: Contest[];
	badges: Badge[];
	profile: LeetCodeProfile;
}

async function fetchLeetCodeData(): Promise<LeetCodeData> {
	const endpoints = [
		"https://leetcode-stats.tashif.codes/khan-tashif",
		"https://leetcode-stats.tashif.codes/khan-tashif/contests",
		"https://leetcode-stats.tashif.codes/khan-tashif/badges",
		"https://leetcode-stats.tashif.codes/khan-tashif/profile"
	];

	try {
		const responses = await Promise.all(
			endpoints.map(endpoint => fetch(endpoint))
		);

		const [stats, contests, badges, profile] = await Promise.all(
			responses.map(response => {
				if (!response.ok) {
					console.error(`Failed to fetch from ${response.url}:`, response.statusText);
					return null;
				}
				return response.json();
			})
		);

		return {
			stats: stats || {
				totalSolved: 0,
				totalQuestions: 0,
				easySolved: 0,
				easyTotal: 0,
				mediumSolved: 0,
				mediumTotal: 0,
				hardSolved: 0,
				hardTotal: 0,
				ranking: 0,
				contributionPoints: 0,
				reputation: 0,
				submissionCalendar: {}
			},
			contests: contests || [],
			badges: badges || [],
			profile: profile || {
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
				submissionCalendar: {}
			}
		};
	} catch (error) {
		console.error("Error fetching LeetCode data:", error);
		return {
			stats: {
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
				submissionCalendar: {}
			},
			contests: [],
			badges: [],
			profile: {
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
				submissionCalendar: {}
			}
		};
	}
}

export const leetCodeData: LeetCodeData = await fetchLeetCodeData();

/** ISO timestamp when LeetCode data was last fetched (build / server). */
export const leetCodeFetchedAt: string = new Date().toISOString();