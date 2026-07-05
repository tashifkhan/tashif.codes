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

export const resumeAbout = {
	greeting: "Holaaaa! 👋",
	introHtml: `I'm an engineering undergraduate based in <span class="text-foreground font-medium">Delhi, India</span>, working at the intersection of <span class="text-foreground font-medium">Full-stack Development</span> and <span class="text-foreground font-medium">Generative AI</span>. I’ve always been driven by the idea that software should bridge the gap between complex systems and the end-user. This philosophy led me to build the <span class="text-foreground font-medium">JIIT Tools Suite</span>. What started as a simple React PWA has now evolved into a platform serving <span class="text-foreground font-medium">18,000+ daily users</span>. In essence I'm an Engineering student by day, <span class="text-foreground font-medium">developer and debater</span> by night, with a passion to solve real world problems (mostly my laziness) via code.`,
	location: "Delhi, India",
	highlights: ["Full Stack Engineer", "Open Source"],
	actions: [
		{
			label: "GitHub",
			url: "https://github.com/tashifkhan",
			icon: "github",
			primary: true,
		},
		{
			label: "LinkedIn",
			url: "https://linkedin.com/in/tashifkhan",
			icon: "linkedin",
		},
		{ label: "Email", url: "mailto:me@tashif.codes", icon: "mail" },
		{
			label: "Resume",
			url: "https://drive.tashif.codes/s/wQJtDaSs5kjkY2p",
			icon: "download",
		},
	] as ResumeAction[],
};

export const resumeProjects: ResumeProject[] = [
	{
		title: "Agentic Browser",
		stack:
			"FastAPI, LangChain, LangGraph, React, TypeScript, MCP, Docker, WebExtension APIs",
		color: "green",
		links: [
			{ label: "Live", url: "https://tashif.codes/agentic-browser" },
			{ label: "GitHub", url: "https://github.com/tashifkhan/agentic-browser" },
		],
		points: [
			"Architected a <strong>model-agnostic web automation platform</strong> combining AI reasoning with browser interaction capabilities via <strong>FastAPI</strong> and <strong>MCP</strong>.",
			"Implemented <strong>LangGraph-based multi-agent orchestration</strong> with specialized tools for web search, content extraction, and Google Workspace integration.",
			"Developed a <strong>dual-mode server</strong> supporting both REST API endpoints and <strong>Model Context Protocol</strong> for seamless agent inter-communication.",
			"Built a <strong>TypeScript browser extension</strong> with a Python backend for direct DOM manipulation and execution of AI-generated script plans.",
			"Designed a <strong>Bring Your Own Keys (BYOKeys)</strong> architecture supporting Gemini, OpenAI, and Anthropic models without vendor lock-in.",
		],
	},
	{
		title: "CodeTrace",
		stack:
			"React 19, TypeScript, Vite, TanStack Router, TanStack Query, Tailwind CSS, Supabase, Recharts",
		color: "blue",
		links: [
			{ label: "Live", url: "https://tashif.codes/codetrace" },
			{
				label: "GitHub",
				url: "https://github.com/stars/tashifkhan/lists/stats-apis",
			},
		],
		points: [
			"Built a unified coding-profile dashboard that aggregates developer statistics from GitHub, LeetCode, Codeforces, GeeksForGeeks, CodeChef, HackerRank, and takeUforward into a single shareable view.",
			"Implemented stateful URL synchronization and saved public profiles via Supabase Auth, enabling clean URLs like /<username>.",
			"Engineered platform-specific deep-dive pages with interactive recharts visualizations for rating history, difficulty breakdowns, and language profiles.",
			"Consolidated daily contributions and submissions from all active platforms into a universal activity heatmap.",
			"Backed by a suite of dedicated REST APIs:",
			'<a href="https://github-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">GitHub Stats</a>, <a href="https://leetcode-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">LeetCode Stats</a>, <a href="https://codeforces-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">CodeForces Stats</a>, <a href="https://gfg-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">GeeksForGeeks Stats</a>, <a href="https://codechef-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">CodeChef Stats</a>, <a href="https://hackerrank-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">HackerRank Stats</a>, and <a href="https://tuf-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">takeUforward Stats</a>.',
			"Deployed with Vercel and configured API rewrites to existing *-stats.tashif.codes microservices for seamless data aggregation.",
		],
	},
	{
		title: "JIIT Tool Suite",
		stack: "React, Next.js, Python, Flask, Pyodide, MongoDB",
		color: "purple",
		links: [
			{ label: "Live", url: "https://jiit-tools.tashif.codes/" },
			{ label: "GitHub", url: "https://github.com/tashifkhan/JIIT-tools-docs" },
		],
		points: [
			"Developed a comprehensive suite of web applications and automation tools to enhance the JIIT student experience.",
			'Developed <a href="https://jportal.tashif.codes/" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">JPortal</a> (<strong>React</strong> PWA for JIIT WebKiosk, 18k+ users) with <strong>Pyodide</strong> PDF parsing.',
			'Created <a href="https://jiit-timetable.tashif.codes/" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">Timetable Website</a> providing real-time schedules for 6.5k+ students.',
			'Implemented <a href="https://jiit-timetable.tashif.codes/mess-menu" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">Mess Menu</a> offering daily/weekly meal plans for 5.2k+ students.',
			'Engineered <a href="https://jiit-placement-updates.tashif.codes/?shh" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">Placement & Campus Updates portal</a> for opportunities/news for 4k+/2k+ users.',
			'Created <a href="https://sophos-autologin.tashif.codes/" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">Sophos Auto-Login</a> scripts (one-click access for ~100 individuals).',
			'Developed <strong>Telegram</strong>-based <a href="https://tashif.codes/projects/jiit-placement-alerts" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">Notification Bot</a> for real-time updates.',
		],
	},
	{
		title: "Home Lab",
		stack: "Docker, Docker Compose, Linux, Bash",
		color: "gray",
		links: [{ label: "GitHub", url: "https://github.com/tashifkhan/home-lab" }],
		points: [
			"Self-hosted lab of 10+ Dockerized services (Nextcloud, Jellyfin, Arr stack).",
			"Secure remote access via Tailscale VPN + Nginx Proxy Manager.",
			"Automated media acquisition and container orchestration.",
		],
	},
];

export const education: Education[] = [
	{
		institute: "Jaypee Institute of Information Technology",
		period: "2022 - 2026",
		degree: "B. Tech Electronics & Communication",
		details: ["CGPA: 7.3/10.0"],
		color: "orange",
	},
	{
		institute: "Delhi Public School, R. K. Puram",
		period: "2018 - 2022",
		details: ["CBSE XII – 94.6%", "CBSE X – 94%"],
		color: "orange",
	},
];

export const positions: Position[] = [
	{
		title: "Treasurer & Senior Advisor",
		org: "Optica Student Chapter JIIT",
		period: "2024 - Present",
		color: "green",
		points: [
			"Orchestrated flagship HC Verma talk with ~4,000 participants (on + off campus).",
			"Coordinated high-engagement comedy talent open mic (~3,000 participants).",
		],
	},
	{
		title: "Mentor",
		org: "The Jaypee Debating Society",
		period: "2023 - Present",
		color: "blue",
		points: [
			"Guided junior cohort in advanced debate strategy elevating competitive performance.",
		],
	},
	{
		title: "Organising Secretary & Cofounder",
		org: "Jaypee Parliamentary Debate",
		period: "2023 - 2024",
		color: "purple",
		points: [
			"Launched inaugural inter‑college debate (JPD 1.0) with 52 external teams; established recurring flagship.",
		],
	},
	{
		title: "Core Executive",
		org: "JOUST'23 | Parola Literary Hub",
		period: "2019 - 2020",
		color: "orange",
		points: [
			"Executed one of India's largest literary festivals (500+ paid participants; ₹700k revenue).",
		],
	},
];

export const skillCategories: SkillCategory[] = [
	{
		label: "Languages",
		color: "orange",
		items: ["Python", "JavaScript", "Go"],
	},
	{
		label: "Frameworks",
		color: "blue",
		items: [
			"Next.js",
			"React.js",
			"React Native",
			"Node.js",
			"Astro",
			"FastAPI",
			"Redux",
			"LangChain",
			"Framer Motion",
		],
	},
	{
		label: "Databases",
		color: "green",
		items: ["PostgreSQL", "MongoDB", "FAISS", "ChromaDB", "SQLite"],
	},
	{
		label: "Tools",
		color: "purple",
		items: ["Git", "Docker", "Vercel", "Pyodide", "Tailscale", "Nginx"],
	},
];
