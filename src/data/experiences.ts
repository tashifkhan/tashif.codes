import type { ExperienceEntry } from "@/types";


export const experiences: ExperienceEntry[] = [
	// {
	// 	company: "Systematic Reasoning",
	// 	role: "Founding Engineer",
	// 	period: "July 2026 – Present",
	// 	color: "orange",
	// 	website: "https://systematicreasoning.com/#/",
	// 	logo: "https://cps-mvp-app-donskov-donskovs-projects.vercel.app/favicon.svg",
	// 	points: [
	// 		"Building <strong>ForgeIQX</strong>, a continuous compliance platform for highly regulated industries — monitoring regulatory requirements, organizational policies, code, and operational artifacts to detect gaps through deterministic, auditable neuro-symbolic analysis.",
	// 		"Contributing to the <strong>reasoning layer</strong> that keeps LLM interpretation bounded, ensuring compliance verdicts are traceable and auditable rather than generated.",
	// 		"Shaping core product architecture and engineering culture from the ground up as a <strong>Founding Engineer</strong>.",
	// 	],
	// },
	{
		company: "SITG France",
		role: "Software Development Engineer",
		period: "May 2026 – Present",
		color: "purple",
		website: "https://sitg.dev",
		logo: "https://35.86.142.168:3000/icon.svg?icon.46fd8538.svg",
		points: [
			"Own the compliance AI pipeline end-to-end; extended it to new regulatory frameworks and certificate scopes.",
			"Built a real-time notification system (<strong>SSE</strong> + <strong>SMTP</strong> + <strong>Slack</strong>) monitoring <strong>Bugzilla</strong>, <strong>Google Groups</strong>, <strong>CCADB</strong>, and <strong>Regulatory Ballots</strong> for same-day compliance surfacing.",
			"Built a continuous regulatory review pipeline; <strong>GitHub Bot</strong> reviews measure the impact of regulatory changes on CPS/Compliance Documents, powered by an internal <strong>Graph RAG LLM</strong> for compliance audits on Ballot releases and Governing Document updates.",
			"Scraped live Google Groups, ballot releases, CAB Forum BR updates, and Root Policy GitHub Releases to build an active monitoring system with <strong>Graph RAG LLM</strong> orchestration.",
		],
	},
	{
		company: "SITG France",
		role: "Software Development Intern",
		period: "Nov 2025 – May 2026",
		color: "purple",
		website: "https://sitg.dev",
		logo: "https://35.86.142.168/icon.svg?icon.46fd8538.svg",
		points: [
			"Built the pipeline the current role now owns: <strong>Django</strong>/<strong>Python</strong> converting hierarchical PDFs to Markdown and extracting structured compliance statements.",
			"Ran LLM workloads async via <strong>Celery</strong>, <strong>Redis</strong>, and <strong>Kafka</strong> so a slow document never blocks a request.",
			"Added semantic search on <strong>OpenSearch</strong> + <strong>PostgreSQL</strong> mapping conformance statements to regulatory standards.",
			"Shipped the first <strong>Next.js</strong> dashboard with <strong>Auth0</strong> for compliance radar metrics.",
		],
	},
	{
		company: "UNICLOUD",
		role: "Software Development Intern",
		period: "May 2025 – July 2025",
		certificate: "https://drive.tashif.codes/s/RsaiDWGCEoXjt2K",
		website: "https://unicloud.co/",
		color: "blue",
		logo: "https://unicloud.co/wp-content/themes/u-design/assets/images/favicon.png",
		points: [
			'Shipped 3 <strong>React</strong> modules (video tracking, shapefile download, block change/edit page) for a <a href="https://irgvap.ircep.gov.in" target="_blank" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">live IRCTC project</a> covering vendor progress monitoring.',
			"Wrote <strong>FastAPI</strong> REST APIs with <strong>JWT auth</strong> on <strong>PostgreSQL</strong>.",
			"Automated DB migration cron jobs; added Block Change Alerts for approvers via <strong>SMTP</strong> and web push.",
		],
	},
];
