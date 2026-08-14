/**
 * Resume and experience content shapes (authored in src/data).
 */

export interface ResumeProject {
	title: string;
	stack: string;
	color: string;
	links: { label: string; url: string }[];
	points: string[];
}

export interface Education {
	institute: string;
	period: string;
	degree?: string;
	details: string[];
	color: string;
}

export interface Position {
	title: string;
	org: string;
	period: string;
	color: string;
	points: string[];
}

export interface SkillCategory {
	label: string;
	color: string;
	items: string[];
}

export interface ResumeAction {
	label: string;
	url: string;
	icon: "github" | "linkedin" | "mail" | "download";
	primary?: boolean;
}

export interface ExperienceEntry {
	company: string;
	role: string;
	period: string;
	color: string;
	points: string[];
	certificate?: string;
	website?: string;
	logo?: string;
}
