/**
 * LeetCode profile, contest, badge, and solve-count shapes.
 */

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
	/** Percent of submissions accepted */
	acceptanceRate?: number;
	submissionCalendar: {
		[date: string]: number;
	};
}

/** One rated contest the user attended, newest first in LeetCodeData. */
export interface Contest {
	title: string;
	/** Unix seconds */
	startTime: number;
	/** Rating after this contest */
	rating: number;
	/** Finishing rank in the contest */
	ranking: number;
	problemsSolved: number;
	totalProblems: number;
	trend: "UP" | "DOWN" | null;
}

export interface ContestSummary {
	attended: number;
	rating: number;
	maxRating: number;
	globalRanking: number;
	totalParticipants: number;
	/** Share of rated users ranked above, e.g. 78.1 means top 78.1% */
	topPercentage: number;
}

export interface Badge {
	id: string;
	displayName: string;
	icon: string;
	createdDate: string;
}

export interface RecentSubmission {
	title: string;
	titleSlug: string;
	/** Unix seconds */
	timestamp: number;
	status: string;
	lang: string;
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
	contestSummary: ContestSummary | null;
	badges: Badge[];
	recentSubmissions: RecentSubmission[];
	profile: LeetCodeProfile;
}
