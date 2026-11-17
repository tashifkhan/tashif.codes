import { Github, Linkedin, Mail, Twitter } from "lucide-react";
import type { SocialLink } from "@/types";


export const owner = {
	name: "Tashif Ahmad Khan",
	avatar: "https://avatars.githubusercontent.com/u/75897907?v=4",
	fallbackTitle: "Software Developer",
};

/** Default contact address used by the header, contact cards, resume and print sheet. */
export const contactEmail = "me@taf.sh";

/**
 * Where people can sponsor the work. Empty until a page exists: the Sponsor
 * button on the resume and in the project header only shows once this is set.
 */
export const sponsorUrl = "";

/**
 * The Google Play developer page. Empty until the developer account is
 * approved. App landings show "Google Play, coming soon" while it is empty and
 * a store button once it is set. Per-app store links go in `playStoreApps`.
 */
export const playStoreDeveloperUrl = "";
export const playStoreApps: Record<string, string> = {
	// paisa: "https://play.google.com/store/apps/details?id=codes.tashif.paisa",
};

/** The install row a landing shows for Google Play. */
export function playStoreRoute(slug: string) {
	const href = playStoreApps[slug] || playStoreDeveloperUrl;
	return href
		? {
				title: "Google Play",
				body: "Install from the Play Store and get updates there.",
				action: { label: "Open in Google Play", href, external: true },
			}
		: {
				title: "Google Play",
				body: "Coming soon. The developer account is being set up.",
			};
}

/** Personal account used when "Personal only" is toggled on. */
export const personalGithubUsername = "tashifkhan";

/** All GitHub accounts (personal + work). Default aggregation source. */
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

/** Non-source formats omitted from authored-code language percentages. */
export const githubLanguageExclusions = [
	"HTML",
	"CSS",
	"Jupyter Notebook",
	"SCSS",
	"CSV",
	"JSON",
	"Markdown",
	"YAML",
	"XML",
	"Text",
	"Ignore List",
	"Git Attributes",
	"Dotenv",
];

/** Explicit attributed stats URL with a versioned response-cache key. */
export function githubAttributedStatsUrl(
	apiBase: string,
	username: string,
): string {
	const params = new URLSearchParams({
		attributed: "true",
		exclude: githubLanguageExclusions.join(","),
		source: "portfolio-own-commits-v2",
	});
	return `${apiBase}/${encodeURIComponent(username)}/stats?${params.toString()}`;
}

export const socials: SocialLink[] = [
	{ icon: Github, link: "https://github.com/tashifkhan", label: "GitHub" },
	{
		icon: Linkedin,
		link: "https://www.linkedin.com/in/tashifkhan/",
		label: "LinkedIn",
	},
	{
		icon: Twitter,
		link: "https://tashif.codes/twitter",
		label: "Twitter",
	},
	{ icon: Mail, link: `mailto:${contactEmail}`, label: "Email" },
];
