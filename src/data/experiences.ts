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
		logo: "https://52.26.46.179:3000/icon.svg?icon.46fd8538.svg",
		page: {
			label: "product page",
			url: "https://taf.sh/products/systematic-reasoning",
		},
		video: {
			label: "visual demonstration",
			url: "https://taf.sh/products/systematic-reasoning",
		},
		points: [
			"Own the AI pipeline that audits certificate authorities' policy documents (<strong>CPS</strong>) against browser and <strong>CA/B Forum</strong> rules. It pulls out every compliance statement, matches it to the rule it has to meet, and reports the gaps. It covers <strong>23 governing documents</strong> from 10 standards bodies (CA/B Forum, Mozilla, Google, Apple, Microsoft, ETSI, IETF, NIST and others), and I extended it to new rule sets and certificate types.",
			"Built a <strong>GitHub App</strong> that reviews pull requests to these policy documents before they merge. It verifies webhook signatures, checks each changed section in a parallel <strong>Celery</strong> chord (it used to review one section at a time), and posts <strong>Graph RAG LLM</strong> comments that a human reviewer can act on. I wrote 95% of that module.",
			"Built the monitoring service (<strong>Django</strong>, <strong>Celery</strong> beat, <strong>Kafka</strong>) that syncs Mozilla's <strong>Bugzilla</strong> incidents, the CA <strong>Google Groups</strong> and <strong>CCADB</strong> every 6 hours, plus a weekly CCADB inventory. An <strong>LLM</strong> reads each new Bugzilla incident and links it to the CA it's about.",
			"Its CCADB checks were validated in a full run over <strong>10K+</strong> CCADB records, <strong>3.6K+</strong> CRLs and <strong>4.1K+</strong> CA certificates, with every queued retry recovered.",
			"Built real-time alerts for <strong>9</strong> event types (new incidents, CA/B Forum ballots, CCADB changes, finished exports and more), delivered in the app over <strong>SSE</strong> on Postgres LISTEN/NOTIFY and to <strong>Slack</strong> through Kafka, with read receipts, replay and retries for anything undelivered.",
			"Wrote <strong>110+ tests</strong> covering download authorisation, API permissions and <strong>OpenAPI</strong> contracts. Changes ship through <strong>GitHub Actions</strong> to <strong>AWS</strong> (ECR, ECS, EC2).",
		],
	},
	{
		company: "SITG France",
		role: "Software Development Intern",
		period: "Nov 2025 – May 2026",
		color: "purple",
		website: "https://sitg.dev",
		logo: "https://52.26.46.179:3000/icon.svg?icon.46fd8538.svg",
		points: [
			"Built v1 of that pipeline in <strong>Django</strong>. It turns a CA's policy PDF into Markdown, splits it by section, and has an LLM extract each compliance statement as structured data.",
			"Moved the LLM analysis to background <strong>Celery</strong> workers (<strong>Redis</strong>, <strong>Kafka</strong>). One CPS needs about <strong>48 minutes</strong> of LLM work across 48 rule classes, so it now runs in the background and the upload request returns straight away.",
			"Built search on <strong>OpenSearch</strong> + <strong>PostgreSQL</strong> that matches each extracted statement to the rules it has to satisfy.",
			"Shipped the first <strong>Next.js</strong> dashboard (<strong>Auth0</strong> login) for the compliance radar, which tracks how quickly each CA updates its documents after the rules change.",
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
			'Built <strong>JWT</strong>-authenticated, role-based <strong>FastAPI</strong> REST APIs on <strong>PostgreSQL</strong> for <a href="https://irgvap.ircep.gov.in" target="_blank" class="text-primary hover:text-primary/80 underline decoration-dotted transition-colors">IRCTC\'s vendor progress tracking platform</a>, used across India. Vendors upload video of their progress, project managers review and list it, and IRCTC officials sign off.',
			"Shipped 3 <strong>React</strong> modules for the same platform: a video progress tracker, shapefile downloads for site maps, and a block change/edit page.",
			"Automated database migrations with cron jobs, and built <strong>SMTP</strong> and web-push alerts that notify approvers when a block changes.",
		],
	},
];
