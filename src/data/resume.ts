import type { Education, Position, ResumeAction, ResumeProject, SkillCategory } from "@/types";



export const resumeAbout = {
	greeting: "Holaaaa! 👋",
	introHtml: `I'm an engineer in <span class="text-foreground font-medium">Delhi, India</span>, building <span class="text-foreground font-medium">full-stack apps and generative AI</span>. I like the problems nobody else is bothering to fix. Off hours I'm poking at my <span class="text-foreground font-medium">home lab</span> or over-engineering something nobody asked for. I use code to solve real problems, mostly my own laziness.`,
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
			url: "https://drive.tashif.codes/s/mqLJP2ZDDeX97Xg",
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
			"Built a <strong>model-agnostic automation platform</strong> where AI agents plan, execute, and verify actions on any website, through <strong>FastAPI</strong> and <strong>MCP</strong>.",
			"<strong>LangGraph</strong> coordinates multiple agents with tools for web search, content extraction, and Google Workspace tasks.",
			"One dual-mode server serves both REST endpoints and <strong>Model Context Protocol</strong> clients.",
			"A <strong>TypeScript extension</strong> drives the DOM directly and executes AI-generated script plans, backed by the Python server.",
			"Bring Your Own Keys: works with Gemini, OpenAI, and Anthropic models.",
		],
	},
	{
		title: "CodeTrace",
		stack:
			"React 19, TypeScript, Vite, TanStack Router, TanStack Query, Tailwind CSS, Supabase, Recharts",
		color: "blue",
		links: [
			{ label: "Live", url: "https://codetrace.xyz" },
			{
				label: "GitHub",
				url: "https://github.com/stars/tashifkhan/lists/stats-apis",
			},
		],
		points: [
			"Coding-profile dashboard that pulls stats from GitHub, LeetCode, Codeforces, GeeksForGeeks, CodeChef, HackerRank, and takeUforward into one shareable page.",
			"Profiles save through Supabase Auth and get clean URLs like /<username>.",
			"Per-platform deep-dive pages with interactive charts for rating history, difficulty breakdowns, and language profiles.",
			"Daily submissions from every platform land in one activity heatmap.",
			"Backed by a suite of dedicated REST APIs:",
			'<a href="https://github-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">GitHub Stats</a>, <a href="https://leetcode-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">LeetCode Stats</a>, <a href="https://codeforces-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">CodeForces Stats</a>, <a href="https://gfg-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">GeeksForGeeks Stats</a>, <a href="https://codechef-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">CodeChef Stats</a>, <a href="https://hackerrank-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">HackerRank Stats</a>, and <a href="https://tuf-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">takeUforward Stats</a>.',
			'Plus a <a href="https://github.com/tashifkhan/GitHost-Stats-API" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">GitHost API</a> for Forgejo, Gitea, and Codeberg profiles.',
			"Deployed on Vercel with rewrites to the *-stats.tashif.codes services.",
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
			"JIIT doesn't really do tech. Timetables lived in random PDFs, attendance was invisible until it already mattered, and companies visited campus while eligible students found out through WhatsApp groups. This suite exists because nobody at the university was going to build it.",
			'Developed <a href="https://jportal.tashif.codes/" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">JPortal</a> (<strong>React</strong> PWA for JIIT WebKiosk, 18k+ users) with <strong>Pyodide</strong> PDF parsing, so marks actually render on a phone.',
			'Created a <a href="https://jiit-timetable.tashif.codes/" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">Timetable Website</a> used by 6.5k+ students.',
			'Added a <a href="https://jiit-timetable.tashif.codes/mess-menu" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">Mess Menu</a> with daily and weekly meal plans, 5.2k+ readers.',
			'Built the <a href="https://jiit-placement-updates.tashif.codes/?shh" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">Placement & Campus Updates portal</a> so opportunities reach students when they can still apply (4k+/2k+ users).',
			'Wrote <a href="https://sophos-autologin.tashif.codes/" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">Sophos Auto-Login</a> scripts because the hostel wifi kicks you off every ~45 minutes (~100 users).',
			'Runs a <strong>Telegram</strong> <a href="https://tashif.codes/projects/jiit-placement-alerts" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">Notification Bot</a> that pushes Superset placement activity.',
		],
	},
	{
		title: "Home Lab",
		stack: "Docker, Docker Compose, Linux, Bash",
		color: "gray",
		links: [{ label: "GitHub", url: "https://github.com/tashifkhan/home-lab" }],
		points: [
			"20+ self-hosted services on Docker: Nextcloud, Jellyfin, OnlyOffice, Forgejo, SearXNG, Homarr.",
			"Media pipeline: Prowlarr/Sonarr/Radarr/Lidarr/Readarr feed qBittorrent through FlareSolverr; Seerr handles requests and Tdarr transcodes.",
			"A custom FastAPI dashboard tracks service health and Tailscale devices.",
			"Remote access over Tailscale VPN with Nginx Proxy Manager in front.",
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
			"Organised a flagship HC Verma talk with ~4,000 participants, on and off campus.",
			"Ran a comedy open mic that drew ~3,000 participants.",
		],
	},
	{
		title: "Mentor",
		org: "The Jaypee Debating Society",
		period: "2023 - Present",
		color: "blue",
		points: [
			"Coach the junior cohort on debate strategy.",
		],
	},
	{
		title: "Organising Secretary & Cofounder",
		org: "Jaypee Parliamentary Debate",
		period: "2023 - 2024",
		color: "purple",
		points: [
			"Started the inaugural inter-college debate (JPD 1.0) with 52 external teams; it now runs as an annual event.",
		],
	},
	{
		title: "Core Executive",
		org: "JOUST'23 | Parola Literary Hub",
		period: "2019 - 2020",
		color: "orange",
		points: [
			"Helped run one of India's largest literary festivals (500+ paid participants, ₹700k revenue).",
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
