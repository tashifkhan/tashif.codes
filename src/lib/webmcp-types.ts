export type WebmcpProject = {
	title: string;
	slug: string;
	url: string;
	description: string;
	languages: string[];
	topics: string[];
	live: string | null;
	github: string;
	pinned: boolean;
	stars: number | null;
	docs: string | null;
};

export type WebmcpPost = {
	slug: string;
	title: string;
	url: string;
	date: string;
	tags: string[];
	excerpt: string;
};

export type WebmcpDocProject = {
	key: string;
	title: string;
	description: string;
	url: string;
	pageCount: number;
	languages: string[];
};

export type WebmcpDocPage = {
	project: string;
	slug: string;
	title: string;
	url: string;
	headings: string[];
	snippet: string;
};

export type WebmcpCatalog = {
	site: string;
	name: string;
	description: string;
	email: string;
	studio: string;
	pages: { id: string; href: string; label: string; url: string }[];
	socials: { label: string; url: string }[];
	github: { handle: string; url: string }[];
	projects: WebmcpProject[];
	posts: WebmcpPost[];
	docs: WebmcpDocProject[];
	docPages: WebmcpDocPage[];
	downloads: { title: string; url: string }[];
	resume: {
		pdf: string;
		location: string;
		about: string;
		highlights: string[];
		experience: { company: string; role: string; period: string; points: string[] }[];
		projects: { title: string; stack: string; points: string[]; links: { label: string; url: string }[] }[];
		education: { institute: string; period: string; degree?: string; details: string[] }[];
		positions: { title: string; org: string; period: string; points: string[] }[];
		skills: { label: string; items: string[] }[];
	};
};
