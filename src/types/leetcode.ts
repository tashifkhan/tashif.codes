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
