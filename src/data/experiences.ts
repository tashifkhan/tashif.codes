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
		period: "April 2026 – Present",
		color: "purple",
		website: "https://sitg.dev",
		logo: "https://35.86.142.168:3000/icon.svg?icon.46fd8538.svg",
		points: [
			"Own the compliance AI pipeline and keep extending it to new regulatory frameworks and certificate scopes.",
			"Shipped <strong>monitoring and alerting</strong> infrastructure that watches Bugzilla and Google Groups for compliance issues.",
			"Built and iterated on the <strong>Next.js</strong> compliance dashboard with <strong>Auth0</strong>, folding client feedback into the metrics views.",
		],
	},
	{
		company: "SITG France",
		role: "Software Development Intern",
		period: "Nov 2025 – Mar 2026",
		color: "purple",
		website: "https://sitg.dev",
		logo: "https://35.86.142.168/icon.svg?icon.46fd8538.svg",
		points: [
			"Built an AI pipeline in <strong>Django</strong>/<strong>Python</strong> that converts hierarchical PDFs to Markdown and extracts structured compliance statements from governing documents.",
			"Ran LLM workloads async through <strong>Celery</strong> and <strong>Redis</strong>, with <strong>Kafka</strong> streaming, so long document processing never blocks a request.",
			"Built semantic search on <strong>OpenSearch</strong> and <strong>PostgreSQL</strong> that maps conformance statements to regulatory standards.",
			"Developed a <strong>Next.js</strong> dashboard with <strong>Auth0</strong> for compliance radar metrics.",
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
			'Built and shipped 3 <strong>React</strong> modules (video tracking, shapefile download, block change/edit page) for a <a href="https://irgvap.ircep.gov.in" target="_blank" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">live IRCTC project</a>, covering vendor progress monitoring and data visualisation.',
			"Wrote <strong>FastAPI</strong> REST APIs with <strong>JWT auth</strong> on <strong>PostgreSQL</strong>.",
			"Automated the DB migration cron jobs and added Block Change Alerts for approvers via SMTP and web push.",
		],
	},
];
