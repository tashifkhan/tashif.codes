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
		title: "TalentSync AI",
		stack:
			"Next.js, TypeScript, FastAPI, LangChain, LangGraph, PostgreSQL, FastStream, Kafka, Redis, Docker",
		color: "orange",
		links: [
			{ label: "Live", url: "https://talentsync.tashif.codes" },
			{ label: "GitHub", url: "https://github.com/tashifkhan/TalentSync" },
		],
		points: [
			"Resume analysis, job category prediction, and a pre-vetted talent dashboard for employers.",
			"<strong>LangChain</strong> + <strong>RAG</strong> + <strong>LangGraph</strong> generate personalised cold emails, interview questions, and answer frameworks.",
			"Parsing layer extracts structured data from raw resumes to drive job-category prediction.",
			"<strong>FastAPI</strong> backend with <strong>PostgreSQL</strong>, containerized with <strong>Docker</strong>; users can plug in their own model keys (<strong>BYOK</strong>).",
		],
	},
	{
		title: "CodeTrace & Stats APIs",
		stack: "React, TypeScript, TanStack Start, Supabase, Python, FastAPI, Redis, Docker",
		color: "blue",
		links: [
			{ label: "Live", url: "https://codetrace.xyz" },
			{
				label: "GitHub",
				url: "https://github.com/stars/tashifkhan/lists/coding-profile-stats-apis",
			},
		],
		points: [
			"<strong>Coding-profile dashboard</strong> pulling stats from GitHub, LeetCode, Codeforces, GeeksForGeeks, CodeChef, HackerRank, and takeUforward into one shareable page.",
			"Per-platform deep-dive pages with <strong>charts</strong> for rating history, difficulty breakdowns, and language profiles. Daily submissions from every platform land in one <strong>activity heatmap</strong>.",
			'Built <strong>REST APIs</strong> for each platform (<a href="https://leetcode-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">LeetCode</a>, <a href="https://github-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">GitHub</a>, <a href="https://gfg-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">GFG</a>, <a href="https://tuf-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">TakeUForward</a>, <a href="https://hackerrank-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">HackerRank</a>, <a href="https://codechef-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">CodeChef</a>, <a href="https://codeforces-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">CodeForces</a>).',
			'Plus a <strong>Self-Hostable Git Platform API</strong> (<a href="https://github.com/tashifkhan/GitHost-Stats-API" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">Forgejo, Gitea, Codeberg</a>).',
			'Basis of <a href="https://rcee.ac.in" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">RCEE</a>\'s <strong>placement portal</strong> <a href="https://sptracker1.vercel.app/" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">here</a> — detailed blog <a href="https://tashif.codes/blog/Ramachandra-College-CodeTrace-Copy" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">here</a>.',
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
			'<a href="https://jportal.tashif.codes/" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors"><strong>JPortal</strong></a> (<strong>React</strong> PWA, <strong>18k+</strong> users) with <strong>Pyodide</strong> PDF parsing, so marks render on a phone.',
			'<a href="https://jiit-timetable.tashif.codes/" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors"><strong>Timetable</strong></a> used by <strong>6.5k+</strong> students; <a href="https://jiit-timetable.tashif.codes/mess-menu" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors"><strong>Mess Menu</strong></a> with daily/weekly meal plans, <strong>5.2k+</strong> readers.',
			'<a href="https://jiit-placement-updates.tashif.codes/?shh" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors"><strong>Placement & Campus Updates</strong></a> portal so opportunities reach students when they can still apply (<strong>4k+/2k+</strong> users).',
			'<a href="https://sophos-autologin.tashif.codes/" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors"><strong>Sophos Auto-Login</strong></a> scripts because the hostel wifi kicks you off every ~45 minutes (~100 users).',
			'<strong>Telegram</strong> <a href="https://tashif.codes/projects/jiit-placement-alerts" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors"><strong>Notification Bot</strong></a> pushing Superset placement activity.',
			'<span class="text-muted-foreground text-sm italic">Built as a JIIT student, 2022–2026.</span>',
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
	{
		title: "F-Droid Apps",
		stack: "React Native, Expo, EAS Build, Android, F-Droid",
		color: "orange",
		links: [
			{ label: "F-Droid", url: "https://tashif.codes/fdroid" },
			{ label: "GitHub", url: "https://github.com/tashifkhan/Paisa" },
		],
		points: [
			'Run a self-hosted <a href="https://tashif.codes/fdroid" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">F-Droid repo</a> at <strong>tashif.codes/fdroid</strong> with 3 signed apps. Add it once, get updates automatically.',
			'<a href="https://github.com/tashifkhan/Paisa" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors"><strong>Paisa</strong></a> keeps the ledger on the phone. It parses bank SMS on device for 100+ Indian banks. SMS never leaves the device, and you can bring your own key for statement imports.',
			'<a href="https://github.com/tashifkhan/caldav-todo" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors"><strong>Patchwork</strong></a> is the task manager I actually use. CalDAV and Nextcloud Deck boards, AI draft from a photo or note, GitHub issues, and widgets that stay quiet until you need them.',
			'<a href="https://github.com/tashifkhan/delhi-metro" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors"><strong>Delhi NCR Metro</strong></a> plans DMRC and NMRC trips. It handles the awkward Sector 52/51 transfer as a walk with two fares, so the price you see is the price you pay.',
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
