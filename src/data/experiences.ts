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
      "Led ownership and ongoing expansion of the compliance AI pipeline, extending coverage to new regulatory frameworks and certificate scopes.",
			"Shipped <strong>Monitoring</strong> and <strong>Alerting</strong> infrastructure to track bugzilla and google groups to detect and respond to compliance issues in real-time.",
			"Shipped and iterated on the <strong>Next.js</strong> compliance dashboard with <strong>Auth0</strong>, incorporating client feedback into metrics visualisations.",
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
			"Built an AI-driven pipeline using <strong>Django</strong> and <strong>Python</strong> to automate hierarchical PDF-to-Markdown conversion and extract structured compliance statements from governing documents.",
			"Implemented <strong>Kafka</strong> for real-time data streaming and <strong>Celery</strong> with <strong>Redis</strong> to manage asynchronous LLM workloads, ensuring non-blocking execution of high-latency document processing.",
			"Integrated <strong>OpenSearch</strong> and <strong>PostgreSQL</strong> to build a semantic search engine using custom logic to align conformance statements with regulatory standards.",
			"Developed a <strong>Next.js</strong> dashboard with <strong>Auth0</strong> to visualise compliance radar metrics analysis.",
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
			'Engineered and deployed 3 critical <strong>React</strong> modules for a <a href="https://irgvap.ircep.gov.in" target="_blank" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">high-profile IRCTC project</a>, significantly enhancing vendor progress monitoring and data visualisation capabilities.',
			"Developed robust <strong>FastAPI</strong> REST APIs, securing data transactions with <strong>JWT authentication</strong> and <strong>PostgreSQL</strong>.",
			"Automated and improved Database Migration Cron jobs to dispatch real-time Block Change Alerts to approvers via <strong>SMTP mail server</strong> and browser <strong>webpush notifications</strong>.",
		],
	},
];
