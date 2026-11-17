import type { Education, Position, ResumeAction, ResumeProject, SkillCategory } from "@/types";
import { contactEmail, sponsorUrl } from "./profile";



export const resumeAbout = {
	greeting: "Holaaaa! 👋",
	introHtml: `I'm an engineer in <span class="text-foreground font-medium">Delhi, India</span>, building <span class="text-foreground font-medium">full-stack apps and generative AI</span>. I like the problems nobody else is bothering to fix. Right now I'm building <a href="https://rah.clinic/" target="_blank" rel="noopener noreferrer" class="text-foreground font-medium underline decoration-dotted underline-offset-4 hover:text-primary transition-colors">rah.clinic</a>, a clinic that runs over WhatsApp, through my studio <a href="https://taf.sh/products/rah-clinic" target="_blank" rel="noopener noreferrer" class="text-foreground font-medium underline decoration-dotted underline-offset-4 hover:text-primary transition-colors">taf.sh</a>. Off hours I'm poking at my <span class="text-foreground font-medium">home lab</span> or over-engineering something nobody asked for. I use code to solve real problems, mostly my own laziness.`,
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
		{ label: "Email", url: `mailto:${contactEmail}`, icon: "mail" },
		{
			label: "Resume",
			url: "https://tashif.codes/resume:pdf",
			icon: "download",
		},
		// Shows once sponsorUrl is set in profile.ts.
		...(sponsorUrl
			? [{ label: "Sponsor", url: sponsorUrl, icon: "heart" as const }]
			: []),
	] as ResumeAction[],
};

/** An inline link in the resume's own style. */
const a = (href: string, text: string) =>
	`<a href="${href}" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">${text}</a>`;

export const resumeProjects: ResumeProject[] = [
	{
		title: "Paisa",
		stack: "Kotlin, Compose Multiplatform, Room, SQLite, WebAssembly",
		color: "green",
		platforms: ["Android", "Web"],
		links: [
			{ label: "Live", url: "https://tashif.codes/projects/paisa" },
			{ label: "GitHub", url: "https://github.com/tashifkhan/Paisa" },
		],
		points: [
			"Every expense app I tried wanted an account, then a subscription. So I wrote one that keeps the ledger on the phone and has no server at all.",
			"Bank SMS becomes a transaction <strong>on the device</strong>, for about <strong>140 Indian banks</strong>. The message never leaves the phone.",
			"Add with AI takes a sentence, a voice note or a receipt and hands back drafts to review. It runs on <strong>your own key</strong>, and stays off without one.",
			"The same <strong>Kotlin</strong> compiles to <strong>WebAssembly</strong>, so the whole app also runs in a browser with SQLite in a web worker.",
			"Bill splitting by item, budgets, widgets, app lock, and encrypted backups to Drive or Nextcloud.",
		],
	},
	{
		title: "Patchwork",
		stack: "Expo, React Native, TypeScript, CalDAV, FastAPI",
		color: "orange",
		platforms: ["Android", "iOS"],
		links: [
			{ label: "Live", url: "https://tashif.codes/projects/patchwork" },
			{ label: "GitHub", url: "https://github.com/tashifkhan/Patchwork" },
		],
		points: [
			"My tasks were spread across Nextcloud, GitHub issues, Jira and a Deck board I forgot existed. Patchwork puts them in one app. It's the task manager I actually use.",
			"<strong>CalDAV</strong> tasks from any server, with ETag checks so two devices can't overwrite each other.",
			"<strong>Jira</strong> boards with sprints and drag and drop that updates the rank, <strong>Nextcloud Deck</strong> boards, and <strong>GitHub Issues</strong> across repos.",
			"AI import drafts tasks from a photo of handwritten notes, on any of nine model providers. You review every task before it's saved.",
			"Credentials stay in the device's secure storage and the app talks to your servers directly.",
		],
	},
	{
		title: "Delhi NCR Metro",
		stack: "Expo, React Native, FastAPI, Cloudflare Workers, SQLite",
		color: "blue",
		platforms: ["Android", "Web", "API"],
		links: [
			{ label: "Live", url: "https://ncr-metro.tashif.codes" },
			{ label: "GitHub", url: "https://github.com/tashifkhan/delhi-metro" },
		],
		points: [
			"Delhi Metro and Noida Metro don't share tickets, and three apps each tell you something different. This plans a trip across both and shows the fare for each.",
			`A ${a("https://ncr-metro.tashif.codes/api", "FastAPI service")} wraps the DMRC services and scrapes the NMRC pages into <strong>one contract</strong>, with no key needed.`,
			"The planner tries the newer Sarthi API first and falls back to the old one on a timeout. The response says which one answered.",
			"A network map drawn from station coordinates, station pages with gates and lifts, and service alerts from both operators.",
			"Lines, stations and planned journeys stay readable with no signal.",
		],
	},
	{
		title: "Agentic Browser",
		stack:
			"FastAPI, LangChain, LangGraph, React, TypeScript, MCP, Docker, WebExtension APIs",
		color: "green",
		platforms: ["Browser extension"],
		links: [
			{ label: "Live", url: "https://tashif.codes/projects/agentic-browser" },
			{ label: "GitHub", url: "https://github.com/tashifkhan/agentic-browser" },
		],
		points: [
			"A browser side panel whose agents <strong>plan, act and verify</strong> on whatever page you have open. Most AI assistants read the web. This one clicks.",
			"<strong>LangGraph</strong> coordinates several agents with tools for web search, Gmail, Calendar and YouTube transcripts.",
			"One Python server answers both REST calls and <strong>Model Context Protocol</strong> clients, so the same tools work from other apps.",
			"A <strong>TypeScript extension</strong> drives the DOM, and every browser action waits for your approval.",
			"Bring your own keys for Gemini, OpenAI or Anthropic, or point it at a local model.",
		],
	},
	{
		title: "TalentSync AI",
		stack:
			"Next.js, TypeScript, FastAPI, LangChain, LangGraph, PostgreSQL, FastStream, Kafka, Redis, Docker",
		color: "orange",
		platforms: ["Web"],
		links: [
			{ label: "Live", url: "https://talentsync.tashif.codes" },
			{ label: "GitHub", url: "https://github.com/tashifkhan/TalentSync" },
		],
		points: [
			"Resume analysis and ATS checks for job seekers, and a pre-vetted talent dashboard for employers.",
			"<strong>LangChain</strong>, <strong>RAG</strong> and <strong>LangGraph</strong> write cold emails, interview questions and answer frameworks from your own resume.",
			"A parsing layer pulls structured data out of raw resumes and predicts the job category.",
			"<strong>FastAPI</strong> on <strong>PostgreSQL</strong>, with slow jobs on <strong>Kafka</strong>. Users can plug in their own model keys.",
		],
	},
	{
		title: "CodeTrace & Stats APIs",
		stack: "React, TypeScript, TanStack Start, Supabase, Python, FastAPI, Redis, Docker",
		color: "blue",
		platforms: ["Web", "API"],
		links: [
			{ label: "Live", url: "https://codetrace.xyz" },
			{
				label: "GitHub",
				url: "https://github.com/stars/tashifkhan/lists/coding-profile-stats-apis",
			},
		],
		points: [
			`${a("/projects/codetrace", "<strong>CodeTrace</strong>")} puts GitHub, LeetCode, Codeforces, GeeksforGeeks, CodeChef, HackerRank and takeUforward on one shareable page.`,
			"Each platform gets its own page with rating history, difficulty breakdowns and languages. Daily submissions from all seven land in one <strong>heatmap</strong>.",
			`None of them hands this data out in one shape, so I wrote a <strong>REST API</strong> for each (${a("/projects/leetcode-stats-api", "LeetCode")}, ${a("/projects/github-stats-api", "GitHub")}, ${a("/projects/gfg-stats-api", "GFG")}, ${a("/projects/tuf-stats-api", "takeUforward")}, ${a("/projects/hackerrank-stats-api", "HackerRank")}, ${a("/projects/codechef-stats-api", "CodeChef")}, ${a("/projects/codeforces-api", "Codeforces")}).`,
			`Plus one for ${a("https://github.com/tashifkhan/GitHost-Stats-API", "Forgejo, Gitea and Codeberg")}, for people who host their own git.`,
			`${a("https://rcee.ac.in", "RCEE")} built their ${a("https://sptracker1.vercel.app/", "placement portal")} on it. I ${a("https://tashif.codes/blog/Ramachandra-College-CodeTrace-Copy", "wrote about that")}.`,
		],
	},
	{
		title: "JIIT Tool Suite",
		stack: "React, Next.js, Python, Flask, Pyodide, MongoDB",
		color: "purple",
		platforms: ["Web"],
		links: [
			{ label: "Live", url: "https://jiit-tools.tashif.codes/" },
			{ label: "GitHub", url: "https://github.com/tashifkhan/JIIT-tools-docs" },
		],
		points: [
			"JIIT doesn't really do tech. Timetables lived in random PDFs, attendance was invisible until it already mattered, and companies visited campus while eligible students found out through WhatsApp groups. This suite exists because nobody at the university was going to build it.",
			`${a("https://codeblech.github.io/jportal/", "<strong>JPortal</strong>")} (<strong>React</strong> PWA, <strong>18k+</strong> users) with <strong>Pyodide</strong> PDF parsing, so marks render on a phone.`,
			`${a("https://jiit-timetable.tashif.codes/", "<strong>Timetable</strong>")} used by <strong>6.5k+</strong> students; ${a("https://jiit-timetable.tashif.codes/mess-menu", "<strong>Mess Menu</strong>")} with daily and weekly meal plans, <strong>5.2k+</strong> readers.`,
			`${a("https://jiit-placement-updates.tashif.codes/?shh", "<strong>Placement & Campus Updates</strong>")} portal so opportunities reach students when they can still apply (<strong>4k+/2k+</strong> users).`,
			`${a("https://sophos-autologin.tashif.codes/", "<strong>Sophos Auto-Login</strong>")} scripts because the hostel wifi kicks you off every ~45 minutes (~100 users).`,
			`<strong>Telegram</strong> ${a("https://tashif.codes/projects/jiit-placement-alerts", "<strong>Notification Bot</strong>")} pushing Superset placement activity.`,
			'<span class="text-muted-foreground text-sm italic">Built as a JIIT student, 2022–2026.</span>',
		],
	},
	{
		title: "Home Lab",
		stack: "Docker, Docker Compose, Linux, Bash",
		color: "gray",
		links: [{ label: "GitHub", url: "https://github.com/tashifkhan/home-lab" }],
		points: [
			"20+ self-hosted services on Docker: Nextcloud, Jellyfin, OnlyOffice, Forgejo, SearXNG, Homarr. One Compose file keeps the stack reproducible.",
			"Media pipeline: Prowlarr/Sonarr/Radarr/Lidarr/Readarr feed qBittorrent through FlareSolverr; Seerr handles requests and Tdarr transcodes overnight so storage stays sane.",
			"A custom FastAPI dashboard tracks service health, container restarts and Tailscale devices, with uptime pings that catch a failed service early.",
			"Remote access over Tailscale VPN with Nginx Proxy Manager in front for SSL and subdomains, tunneled through a VPS so it works without a static IP.",
			"Nightly backups to local disk and an encrypted offsite copy, plus Watchtower for updates and health checks that alert if anything stays down.",
		],
	},
];

export const education: Education[] = [
	{
		institute: "Jaypee Institute of Information Technology",
		period: "2022 - 2026",
		degree: "B. Tech Electronics & Communication",
		details: ["CGPA: 7.4/10.0"],
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
		items: ["Python", "TypeScript", "Kotlin", "Go", "SQL"],
	},
	{
		label: "Frameworks",
		color: "blue",
		items: [
			"FastAPI",
			"Django",
			"Next.js",
			"React",
			"React Native",
			"Expo",
			"Compose Multiplatform",
			"Astro",
			"TanStack Start",
			"LangGraph",
			"LangChain",
		],
	},
	{
		label: "Data",
		color: "green",
		items: ["PostgreSQL", "SQLite", "MongoDB", "Redis", "OpenSearch", "Kafka"],
	},
	{
		label: "Tools",
		color: "purple",
		items: [
			"Docker",
			"Git",
			"GitHub Actions",
			"Cloudflare Workers",
			"Vercel",
			"Celery",
			"Tailscale",
			"Nginx",
		],
	},
];
