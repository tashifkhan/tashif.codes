import { Github, Globe, Linkedin, Mail, Twitter } from "lucide-react";

export interface SocialLink {
	icon: React.ComponentType<{ className?: string; size?: number | string }>;
	link: string;
	label: string;
}

export const owner = {
	name: "Tashif Ahmad Khan",
	avatar: "https://avatars.githubusercontent.com/u/75897907?v=4",
	fallbackTitle: "Software Developer",
};

export const githubUsernames = [
	"tashifkhan",
	"tashifkhansitg",
	"tashifkhanSR",
];

export const githubProfiles = githubUsernames.map((handle) => ({
	handle,
	url: `https://github.com/${handle}`,
}));

export const githubStatsApiBase = "https://github-stats.tashif.codes";

export const socials: SocialLink[] = [
	{ icon: Github, link: "https://github.com/tashifkhan", label: "GitHub" },
	{ icon: Globe, link: "https://portfolio.tashif.codes", label: "Portfolio" },
	{
		icon: Linkedin,
		link: "https://www.linkedin.com/in/tashifkhan/",
		label: "LinkedIn",
	},
	{
		icon: Twitter,
		link: "https://twitter.com/khan__tashif",
		label: "Twitter",
	},
	{ icon: Mail, link: "mailto:tashif@duck.com", label: "Email" },
];
