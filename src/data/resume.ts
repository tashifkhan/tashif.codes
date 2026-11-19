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
		title: "Agentic Browser",
		stack:
			"FastAPI, LangGraph, LangChain, MCP, React, TypeScript, WXT, PostgreSQL, OpenSearch, Neo4j",
		color: "green",
		links: [
			{ label: "Live", url: "https://tashif.codes/projects/agentic-browser" },
			{ label: "GitHub", url: "https://github.com/tashifkhan/agentic-browser" },
		],
		extras: [
			{ label: "demo reel", url: "https://taf.sh/media/agentic-browser/demo.mp4", kind: "video" },
		],
		points: [
			"A browser agent that works on any website: a <strong>WXT</strong>/<strong>React</strong> side-panel extension talks to a <strong>FastAPI</strong> backend, which serves <strong>120+ REST endpoints</strong> and an <strong>MCP</strong> server from the same port.",
			"A <strong>LangGraph</strong> supervisor hands each task to a research, browser, productivity or coding subagent. An LLM then scores the draft answer from 0 to 10 and sends it back for another pass if it falls short.",
			"<strong>17+ tools</strong> for the agents: Tavily web search, page scraping, YouTube transcripts, GitHub repo Q&A, Gmail, Google Calendar, LinkedIn, and sandboxed bash and Python.",
			"Browser automation runs one step at a time. The extension sends a snapshot of the page (visible text and interactive elements), the planner picks one of 9 action types, and the extension executes it through the WebExtension scripting APIs and snapshots the page again.",
			"Loop guards stop it on a captcha, a login wall, three steps with no change to the page, or the same action failing twice, so it doesn't click around forever.",
			"Long-term memory: <strong>OpenSearch</strong> hybrid vector and BM25 search merged with reciprocal rank fusion, plus <strong>Neo4j</strong> graph traversal, kept tidy by hourly, nightly and weekly consolidation, decay and dedup jobs.",
			"Bring your own keys for <strong>6 LLM providers</strong> (Gemini, OpenAI, Anthropic, Ollama, DeepSeek, OpenRouter), stored encrypted in <strong>PostgreSQL</strong>.",
			"Voice in and out (faster-whisper, OpenAI or Groq for speech-to-text, four text-to-speech providers), streaming over SSE, and a Telegram bot on the same backend. 14 GitHub stars.",
		],
	},
	{
		title: "TalentSync AI",
		stack:
			"Next.js, TypeScript, FastAPI, LangGraph, NATS JetStream, FastStream, PostgreSQL, Docker, Prometheus, Grafana",
		color: "orange",
		links: [
			{ label: "Live", url: "https://talentsync.tashif.codes" },
			{ label: "GitHub", url: "https://github.com/tashifkhan/TalentSync" },
		],
		extras: [
			{ label: "product page", url: "https://taf.sh/products/talentsync", kind: "page" },
			{ label: "HR dashboard", url: "https://taf.sh/products/talentsync-hr", kind: "page" },
			{ label: "demo reel", url: "https://taf.sh/media/talentsync/demo.mp4", kind: "video" },
		],
		points: [
			"AI career platform. Candidates get resume analysis, ATS scoring, tailored resume PDFs, cold emails, LinkedIn posts and interview prep. Employers get a dashboard of pre-vetted talent.",
			"Uploads are parsed in memory: PDFs to Markdown with <strong>PyMuPDF</strong>, DOCX straight from its XML, and scanned PDFs with no text layer go to Gemini as raw bytes.",
			"Every AI task is a durable job. <strong>FastAPI</strong> stores it in <strong>PostgreSQL</strong> and publishes only its id on <strong>NATS JetStream</strong>, so API keys never travel through the queue. <strong>FastStream</strong> workers run <strong>31 job types</strong> across 5 lanes, with exponential-backoff retries, a dead-letter stream and a reaper that recovers jobs from crashed workers. The browser follows progress over <strong>SSE</strong>.",
			"<strong>3 LangGraph</strong> tool-calling agents: an ATS evaluator, a resume generator and a career coach. The coach searches the web through Tavily, Brave and SearXNG in parallel and merges the results with reciprocal rank fusion.",
			"Works with <strong>8 LLM providers</strong> (Gemini, OpenAI, Anthropic, Ollama, OpenRouter and more) through 22 per-task model routes. Users can bring their own keys (<strong>BYOK</strong>), stored <strong>AES-256-GCM</strong> encrypted.",
			"<strong>120+ API endpoints</strong>. Google OAuth with httpOnly JWT cookies and rotating refresh tokens, where reusing an old token revokes the whole family. Usage metering takes a Postgres advisory lock per user, and refunds can't fire twice.",
			"<strong>GitHub Actions</strong> builds the images and deploys them with <strong>Docker Compose</strong>. One backend image runs as the API, the workers or the migration job. Prometheus and Grafana handle observability.",
		],
	},
	{
		title: "CodeTrace & Stats APIs",
		stack: "Python, FastAPI, Redis, BeautifulSoup, GraphQL, OpenTelemetry, React, TypeScript, TanStack Router, React Query, PostgreSQL, Vercel",
		color: "blue",
		links: [
			{ label: "Live", url: "https://codetrace.xyz" },
			{ label: "Stats", url: "https://tashif.codes/projects/stats?project=stats-apis" },
			{
				label: "GitHub",
				url: "https://github.com/stars/tashifkhan/lists/coding-profile-stats-apis",
			},
		],
		extras: [
			{ label: "case study", url: "https://taf.sh/work/stats-apis", kind: "page" },
			{ label: "CodeTrace demo", url: "https://taf.sh/media/codetrace/demo.mp4", kind: "video" },
			{ label: "APIs demo", url: "https://taf.sh/media/stats-apis/demo.mp4", kind: "video" },
		],
		points: [
			"<strong>CodeTrace</strong> puts a developer's GitHub, LeetCode, Codeforces, GeeksForGeeks, CodeChef, HackerRank and takeUforward profiles on one page, with rating history, difficulty breakdowns and one merged <strong>activity heatmap</strong>. Sign in with Google and <code>/username</code> becomes a shareable profile, stored in <strong>PostgreSQL</strong> with row-level security.",
			"It fetches every linked account in parallel. If one platform is down, that card shows a gap and the rest of the page still loads.",
			'None of these platforms share their data in one format, so I built a public <strong>REST API</strong> for each (<a href="https://leetcode-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">LeetCode</a>, <a href="https://github-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">GitHub</a>, <a href="https://gfg-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">GFG</a>, <a href="https://tuf-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">TakeUForward</a>, <a href="https://hackerrank-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">HackerRank</a>, <a href="https://codechef-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">CodeChef</a>, <a href="https://codeforces-stats.tashif.codes" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">CodeForces</a>). Each gets its data the way its platform allows: <strong>GraphQL</strong> for LeetCode and GitHub, the official Codeforces API, undocumented JSON endpoints for GFG, TUF and HackerRank, and <strong>BeautifulSoup</strong> scraping plus JSON pulled from inline scripts for CodeChef.',
			"All seven return the same sections (profile, stats, contests, rating, heatmap, badges) over <strong>75+ endpoints</strong>.",
			"<strong>Redis</strong> caches whole responses and each upstream call. Identical requests share one upstream fetch, and if a platform fails the API serves data up to an hour old. Per-IP and per-handle rate limits protect the platforms, and an 8 second budget keeps every call inside Vercel's 10 second limit.",
			"The APIs served <strong>156K requests</strong> from 20 Oct to 18 Nov 2026, and <strong>400+ other websites</strong> call them, mostly developer portfolios. Every request now sends an <strong>OpenTelemetry</strong> span to Honeycomb with the endpoint, status, latency, cache result and caller.",
			'A <a href="https://github.com/tashifkhan/GitHost-Stats-API" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">self-hostable version</a> does the same for Forgejo, Gitea and Codeberg, and rebuilds full contribution history from commits.',
			'<a href="https://rcee.ac.in" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">RCEE</a> built its <a href="https://sptracker1.vercel.app/" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">student placement tracker</a> on a copy of CodeTrace. The full story is <a href="https://tashif.codes/blog/Ramachandra-College-CodeTrace-Copy" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">on the blog</a>.',
		],
	},
	{
		title: "JIIT Tool Suite",
		stack: "React, Next.js, Python, Pyodide (WebAssembly), LangGraph, Gemini, MongoDB, SQLite, Telegram Bot API",
		color: "purple",
		links: [
			{ label: "Live", url: "https://jiit-tools.tashif.codes/" },
			{ label: "GitHub", url: "https://github.com/tashifkhan/JIIT-tools-docs" },
		],
		points: [
			"JIIT doesn't really do tech. Timetables lived in random PDFs, attendance was invisible until it already mattered, and companies visited campus while eligible students found out through WhatsApp groups. This suite exists because nobody at the university was going to build it.",
			'<a href="https://jportal.tashif.codes/" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors"><strong>JPortal</strong></a> is a <strong>React</strong> PWA that replaces JIIT\'s old web portal for attendance, exams, grades and SGPA/CGPA. It logs in without the portal\'s captcha through <a href="https://tashif.codes/projects/jsjiit" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">jsjiit</a>, a browser client for the portal API. <strong>19.4K</strong> MAU at its peak, <strong>91K</strong> page views.',
			'<a href="https://jiit-timetable.tashif.codes/" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors"><strong>Timetable</strong></a> runs the Python timetable parser in the browser with <strong>Pyodide</strong>, so nothing hits a server and it works offline. It builds your schedule from batch and electives, finds free slots you share with friends, and exports to PDF, PNG or Google Calendar. <strong>9.9K</strong> MAU at its peak, <strong>163K</strong> page views. The <a href="https://jiit-timetable.tashif.codes/mess-menu" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors"><strong>Mess Menu</strong></a> next to it has daily and weekly meal plans.',
			'<a href="https://jiit-placement-updates.tashif.codes/?shh" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors"><strong>Placement & Campus Updates</strong></a> gets openings to students while they can still apply. A Python bot logs into the SuperSet placement portal every hour, drops duplicates, formats notices with <strong>LangGraph</strong> and Gemini, stores them in <strong>MongoDB</strong>, and broadcasts them through a <a href="https://tashif.codes/projects/jiit-placement-alerts" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors"><strong>Telegram bot</strong></a>. <strong>13.2K</strong> MAU at its peak, <strong>137K</strong> page views.',
			'<a href="https://sophos-autologin.tashif.codes/" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors"><strong>Sophos Auto-Login</strong></a> exists because the hostel wifi logs you out every ~45 minutes. It logs back in every 2 minutes and switches to the next saved account when one hits its data limit (15 GitHub stars).',
			'<span class="text-muted-foreground text-sm italic">Built as a JIIT student, 2022–2026. MAU is the sum of daily unique visitors in each tool\'s best month, from the <a href="/projects/stats" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">stats page</a>.</span>',
		],
	},
	{
		title: "Home Lab",
		stack: "Docker Compose, Linux, Tailscale, Nginx Proxy Manager, FastAPI, Forgejo Actions",
		color: "gray",
		links: [
			{ label: "Live", url: "https://tashif.codes/projects/home-lab" },
			{ label: "GitHub", url: "https://github.com/tashifkhan/home-lab" },
		],
		extras: [{ label: "how it's set up", url: "https://tashif.codes/projects/home-lab", kind: "page" }],
		points: [
			"<strong>30 containers</strong> in <strong>10 Docker Compose stacks</strong> on one Linux box: Jellyfin, Nextcloud with Euro-Office, Forgejo, SearXNG, BentoPDF, my dump.lab notes app and a full media pipeline.",
			"No static IP, so public traffic goes through Cloudflare to <strong>Nginx Proxy Manager</strong> on a VPS (TLS and subdomains) and over <strong>Tailscale</strong> to the house. Admin tools bind only to the Tailscale address, and the server is a Tailscale exit node.",
			"Requests in Seerr flow through Sonarr/Radarr and Prowlarr to qBittorrent. Bazarr adds subtitles, and Tdarr keeps the original while adding 1080p and 720p copies for weaker clients.",
			"A <strong>FastAPI</strong> dashboard (Material 3, installable PWA) shows health for about 22 services, every Tailscale device with its battery, and short links like /git.",
			"Self-hosted <strong>Forgejo</strong> with three Actions runners redeploys dump.taf.sh on every push. I also maintain Taflix skins for Jellyfin and a 26-theme Forgejo.",
			"Upgrades are by hand and written up in the repo, including a 20-image upgrade with Postgres 16 to 18 and a failed-disk diagnosis.",
		],
	},
	{
		title: "F-Droid Apps",
		stack: "Kotlin, Compose Multiplatform, React Native, Expo, FastAPI, F-Droid",
		color: "orange",
		platforms: ["Android", "iOS", "Web"],
		links: [
			{ label: "F-Droid", url: "https://tashif.codes/fdroid" },
			{ label: "GitHub", url: "https://github.com/tashifkhan/Paisa" },
		],
		extras: [
			{ label: "Paisa demo", url: "https://taf.sh/media/paisa/demo.mp4", kind: "video" },
			{ label: "Patchwork demo", url: "https://taf.sh/media/patchwork/demo.mp4", kind: "video" },
			{ label: "Metro demo", url: "https://taf.sh/media/delhi-metro/demo.mp4", kind: "video" },
		],
		points: [
			`I run my own ${a("https://tashif.codes/fdroid", "F-Droid repo")} at <strong>tashif.codes/fdroid</strong> with 3 signed apps. Add it once and updates show up like any other F-Droid app.`,
			`${a("/projects/paisa", "<strong>Paisa</strong>")} (Android, Web) keeps the ledger on the phone, because every expense app I tried wanted an account and then a subscription. Bank SMS turns into transactions on the device for about <strong>140 Indian banks</strong>, and the same Kotlin runs in a browser through WebAssembly.`,
			`${a("/projects/patchwork", "<strong>Patchwork</strong>")} (Android, iOS) is the task manager I actually use. My tasks were spread across CalDAV, Nextcloud Deck, Jira and GitHub issues, so it signs in to all four and edits them where they live.`,
			`${a("/projects/delhi-metro", "<strong>Delhi NCR Metro</strong>")} (Android, Web) plans trips across DMRC and NMRC, which don't share tickets. It runs on a ${a("https://ncr-metro.tashif.codes/api", "FastAPI service")} I wrote that wraps both operators into one contract.`,
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
		items: ["PostgreSQL", "SQLite", "MongoDB", "Redis", "OpenSearch", "Kafka", "NATS"],
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
			"OpenTelemetry",
			"Tailscale",
			"Nginx",
		],
	},
];
