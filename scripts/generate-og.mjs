#!/usr/bin/env bun
/**
 * Generates high-quality Open Graph & social share thumbnails (1200×630 sRGB JPEGs)
 * for all routes across tashif.codes:
 *  - Global brand default / home (/og/default.jpg, /og/home.jpg)
 *  - Section dashboards (/og/resume.jpg, /og/github.jpg, /og/leetcode.jpg, /og/connect.jpg)
 *  - Section stats (/og/github-stats.jpg, /og/leetcode-stats.jpg, /og/projects-stats.jpg)
 *  - Catalogs & hubs (/og/projects.jpg, /og/docs.jpg, /og/fdroid.jpg, /og/blog.jpg)
 *  - Individual project detail pages (/og/projects/<slug>.jpg)
 *  - Project documentation pages (/og/docs/<project>.jpg)
 *  - App download pages (/og/download/<title>.jpg)
 *  - Blog post covers rasterized from upstream SVGs (/og/blog/<slug>.jpg)
 *
 * Runs as `prebuild` so Vercel/CI always ships fresh, pixel-perfect social images.
 */
import { mkdir, writeFile, access, readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { projectOverrides } from "../src/data/projectOverrides.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OG_DIR = join(ROOT, "public", "og");
const BLOG_OUT_DIR = join(OG_DIR, "blog");
const PROJECTS_OUT_DIR = join(OG_DIR, "projects");
const DOCS_OUT_DIR = join(OG_DIR, "docs");
const DOWNLOAD_OUT_DIR = join(OG_DIR, "download");
const FONT_DIR = join(ROOT, "scripts", "fonts");

const BLOG_API =
	process.env.BLOG_API_BASE ?? "https://blog.tashif.codes/api";
const BLOG_ORIGIN = new URL(BLOG_API).origin;

const RASTER_EXT = /\.(png|jpe?g|webp|gif)$/i;
const SVG_EXT = /\.svg$/i;

const LANGUAGE_COLORS = {
	javascript: "#f1e05a",
	typescript: "#3178c6",
	python: "#3572a5",
	html: "#e34c26",
	css: "#563d7c",
	scss: "#c6538c",
	java: "#b07219",
	kotlin: "#a97bff",
	swift: "#f05138",
	dart: "#00b4ab",
	go: "#00add8",
	rust: "#dea584",
	c: "#555555",
	"c++": "#f34b7d",
	"c#": "#178600",
	php: "#4f5d95",
	ruby: "#701516",
	shell: "#89e051",
	powershell: "#012456",
	lua: "#000080",
	vue: "#41b883",
	svelte: "#ff3e00",
	astro: "#ff5a03",
	jupyter: "#da5b0b",
	"jupyter notebook": "#da5b0b",
	dockerfile: "#384d54",
};

function getLanguageColor(lang) {
	if (!lang) return "#94a3b8";
	return LANGUAGE_COLORS[lang.trim().toLowerCase()] ?? "#94a3b8";
}

function escapeXml(unsafe) {
	return String(unsafe || "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function wrapText(text, maxChars, maxLines = 2) {
	const words = (text || "").trim().split(/\s+/);
	if (!words.length || !words[0]) return [];
	const lines = [];
	let current = "";
	for (let i = 0; i < words.length; i++) {
		const word = words[i];
		if (!current) {
			current = word;
		} else if ((current + " " + word).length <= maxChars) {
			current += " " + word;
		} else {
			lines.push(current);
			current = word;
			if (lines.length === maxLines - 1) {
				const remainder = words.slice(i).join(" ");
				if (remainder.length <= maxChars) {
					lines.push(remainder);
				} else {
					let truncated = remainder.slice(0, maxChars - 3);
					const lastSpace = truncated.lastIndexOf(" ");
					if (lastSpace > 10) truncated = truncated.slice(0, lastSpace);
					lines.push(truncated.trim() + "...");
				}
				return lines;
			}
		}
	}
	if (current && lines.length < maxLines) {
		lines.push(current);
	}
	return lines;
}

function formatTitle(title) {
	let formatted = (title || "").replace(/-/g, " ");
	let result = "";
	for (let i = 0; i < formatted.length; i++) {
		const char = formatted[i];
		const nextChar = formatted[i + 1];
		if (
			char >= "a" &&
			char <= "z" &&
			nextChar &&
			nextChar >= "A" &&
			nextChar <= "Z"
		) {
			result += char + " ";
		} else {
			result += char;
		}
	}
	return result
		.split(/\s+/)
		.filter(Boolean)
		.map((word) => {
			if (word === word.toUpperCase() && word.length > 1) return word;
			return word[0].toUpperCase() + word.slice(1).toLowerCase();
		})
		.join(" ");
}

/** Map authoring stacks -> fonts we ship */
function remapFonts(svgText) {
	return svgText
		.replace(
			/font-family="Impact,\s*Haettenschweiler,\s*'Arial Black',\s*'Helvetica Neue',\s*sans-serif"/gi,
			'font-family="Anton, Impact, \'Arial Black\', sans-serif"',
		)
		.replace(
			/font-family="'DM Sans',\s*'Helvetica Neue',\s*Arial,\s*sans-serif"/gi,
			'font-family="DM Sans, \'Helvetica Neue\', Arial, sans-serif"',
		)
		.replace(
			/font-family="ui-monospace,\s*SFMono-Regular,\s*'Geist Mono',\s*Menlo,\s*monospace"/gi,
			'font-family="JetBrains Mono, ui-monospace, Menlo, monospace"',
		);
}

function resolveCoverUrl(path) {
	if (!path || typeof path !== "string") return null;
	const trimmed = path.trim();
	if (!trimmed) return null;
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	return `${BLOG_ORIGIN}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

async function exists(path) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function collectFontFiles() {
	const files = [];
	try {
		for (const name of await readdir(FONT_DIR)) {
			if (/\.(ttf|otf|ttc)$/i.test(name)) {
				files.push(join(FONT_DIR, name));
			}
		}
	} catch {
		// optional
	}
	for (const extra of [
		"/System/Library/Fonts/Supplemental/Impact.ttf",
		"/System/Library/Fonts/Supplemental/Arial Black.ttf",
	]) {
		if (await exists(extra)) files.push(extra);
	}
	return files;
}

// The card's palette is the site's studio skin in dark: warm near-black,
// one teal accent.
const OG = {
	paper: "#0e0d0d",
	panel: "#161514",
	ink: "#f4f1ec",
	muted: "#a39d96",
	faint: "#6f6963",
	rule: "#2a2725",
	accent: "#4fd1c5",
};
const ART = { x: 700, y: 118, width: 436, height: 356, radius: 20 };

function generateSiteOgSvg({
	badge = "Portfolio",
	title = "Tashif Ahmad Khan",
	description = "Personal dashboard, open source projects, engineering blog, and developer tools.",
	featureBoxes = [],
	tags = [],
	footerRight = "https://tashif.codes",
	// When set, the right side is left clear for a picture composited later.
	art = false,
}) {
	const textWidth = art ? 590 : 1068;
	const titleSize = art ? (title.length > 14 ? 58 : 70) : title.length > 24 ? 62 : 76;
	const titleLines = wrapText(title, Math.floor(textWidth / (titleSize * 0.56)), art ? 3 : 2);
	const descSize = 27;
	const descLines = wrapText(description, Math.floor(textWidth / (descSize * 0.5)), 3);
	const titleY = 196;
	const descY = titleY + (titleLines.length - 1) * (titleSize + 6) + 58;

	// Facts sit on one baseline, parted by hairlines. No boxes.
	const facts = featureBoxes.slice(0, art ? 3 : 4);
	const factWidth = facts.length ? Math.min(250, Math.floor(textWidth / facts.length)) : 0;
	const factsSvg = facts
		.map(
			(box, i) => `
    <g transform="translate(${i * factWidth}, 0)">
      ${i > 0 ? `<line x1="-24" y1="-34" x2="-24" y2="28" stroke="${OG.rule}" stroke-width="1.5"/>` : ""}
      <text y="0" fill="${OG.ink}" font-family="Lexend" font-size="32" font-weight="bold">${escapeXml(box.title)}</text>
      <text y="28" fill="${OG.faint}" font-family="DM Sans" font-size="17" font-weight="bold">${escapeXml(sentenceCase(box.subtitle))}</text>
    </g>`,
		)
		.join("");

	const tagLine = !art && tags.length
		? wrapText(tags.slice(0, 6).map((t) => t.label.replace(/^#/, "")).join(", "), 90, 1)[0]
		: "";

	const section = escapeXml(badge);
	const url = escapeXml(footerRight.replace(/^https?:\/\//, ""));

	return `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <pattern id="dots" width="30" height="30" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.3" fill="${OG.ink}" fill-opacity="0.06"/>
    </pattern>
    <radialGradient id="fade" cx="0%" cy="0%" r="90%">
      <stop offset="0%" stop-color="${OG.paper}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${OG.paper}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="${OG.paper}"/>
  <rect width="1200" height="630" fill="url(#dots)"/>
  <rect width="1200" height="630" fill="url(#fade)"/>
  <rect x="0" y="0" width="1200" height="8" fill="${OG.accent}"/>

  <text x="66" y="84" font-family="Lexend" font-size="24" font-weight="bold">
    <tspan fill="${OG.ink}">tashif.codes</tspan><tspan fill="${OG.faint}" dx="14">/</tspan><tspan fill="${OG.accent}" dx="14">${section}</tspan>
  </text>

  <text x="66" y="${titleY}" fill="${OG.ink}" font-family="Lexend" font-size="${titleSize}" font-weight="bold" letter-spacing="-0.03em">
    ${titleLines.map((line, idx) => `<tspan x="66" dy="${idx === 0 ? 0 : titleSize + 6}">${escapeXml(line)}</tspan>`).join("")}
  </text>

  <text x="66" y="${descY}" fill="${OG.muted}" font-family="DM Sans" font-size="${descSize}" font-weight="bold">
    ${descLines.map((line, idx) => `<tspan x="66" dy="${idx === 0 ? 0 : descSize + 9}">${escapeXml(line)}</tspan>`).join("")}
  </text>

  ${factsSvg ? `<g transform="translate(66, 478)">${factsSvg}</g>` : ""}
  ${tagLine ? `<text x="66" y="${factsSvg ? 420 : 470}" fill="${OG.faint}" font-family="DM Sans" font-size="20" font-weight="bold">${escapeXml(tagLine)}</text>` : ""}

  ${art ? `<rect x="${ART.x - 1}" y="${ART.y - 1}" width="${ART.width + 2}" height="${ART.height + 2}" rx="${ART.radius + 1}" fill="${OG.panel}" stroke="${OG.rule}" stroke-width="2"/>` : ""}

  <line x1="66" y1="548" x2="1134" y2="548" stroke="${OG.rule}" stroke-width="1.5"/>
  <text x="66" y="588" fill="${OG.ink}" font-family="DM Sans" font-size="20" font-weight="bold">Tashif Ahmad Khan</text>
  <text x="1134" y="588" text-anchor="end" fill="${OG.accent}" font-family="JetBrains Mono" font-size="18" font-weight="bold">${url}</text>
</svg>
`;
}

function sentenceCase(text) {
	const lower = String(text ?? "").toLowerCase();
	return (lower.charAt(0).toUpperCase() + lower.slice(1))
		.replace(/\bgithub\b/gi, "GitHub")
		.replace(/\b(cli|api|apis|rss|pdf)\b/gi, (word) => word.toUpperCase().replace("APIS", "APIs"));
}

/** A project's own picture for its card, when it has one in public/. */
function projectArt(slug) {
	const candidates = [
		`public/landings/${slug}/poster.webp`,
		`public/landings/${slug}/walkthrough-poster.webp`,
	];
	const hit = candidates.map((c) => join(ROOT, c)).find((c) => existsSync(c));
	return hit ?? null;
}

/** The tagline a landing declares, so the card and the page say the same thing. */
function landingTagline(slug) {
	const file = join(ROOT, "src", "landings", `${slug}.astro`);
	if (!existsSync(file)) return null;
	const match = readFileSync(file, "utf8").match(/tagline:\s*\n?\s*"([^"]+)"/);
	return match ? match[1] : null;
}

/** Rounds a picture into the card's art frame and returns it for compositing. */
async function artLayer(file) {
	const mask = Buffer.from(
		`<svg width="${ART.width}" height="${ART.height}"><rect width="${ART.width}" height="${ART.height}" rx="${ART.radius}"/></svg>`,
	);
	const input = await sharp(file)
		.resize(ART.width, ART.height, { fit: "cover", position: "top" })
		.composite([{ input: mask, blend: "dest-in" }])
		.png()
		.toBuffer();
	return { input, left: ART.x, top: ART.y };
}

async function rasterizeSvg(svgText, outPath, fontFiles, defaultFont = "DM Sans", layers = []) {
	const svg = remapFonts(svgText);
	const resvg = new Resvg(svg, {
		fitTo: { mode: "width", value: 1200 },
		background: "#0a0e17",
		font: {
			loadSystemFonts: true,
			fontFiles,
			defaultFontFamily: defaultFont,
		},
	});
	const rendered = resvg.render();
	const png = rendered.asPng();
	const jpeg = await sharp(png)
		.resize(1200, 630, { fit: "fill" })
		.composite(layers)
		.flatten({ background: "#0a0e17" })
		.jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: "4:4:4" })
		.toColorspace("srgb")
		.toBuffer();
	await mkdir(dirname(outPath), { recursive: true });
	await writeFile(outPath, jpeg);
	return jpeg.byteLength;
}

async function generateCoreCards(fontFiles) {
	const coreCards = [
		{
			out: join(OG_DIR, "default.jpg"),
			data: {
				command: "cat profile.json",
				badge: "Portfolio",
				badgeColor: "#ea580c",
				title: "Tashif Ahmad Khan",
				description:
					"Personal dashboard, open source projects, engineering blog, and developer tools.",
				featureBoxes: [
					{ title: "80+", subtitle: "Projects & Tools" },
					{ title: "1,000+", subtitle: "GitHub Commits" },
					{ title: "19", subtitle: "Tech Articles" },
					{ title: "Full-Stack", subtitle: "Web & Systems" },
				],
				tags: [
					{ label: "TypeScript", color: "#3178c6" },
					{ label: "Python", color: "#3572a5" },
					{ label: "React", color: "#61dafb" },
					{ label: "Cloudflare Workers", color: "#f38020" },
					{ label: "Android", color: "#a97bff" },
					{ label: "Go", color: "#00add8" },
				],
				footerRight: "https://tashif.codes",
			},
		},
		{
			out: join(OG_DIR, "home.jpg"),
			data: {
				command: "cat dashboard.json",
				badge: "Dashboard",
				badgeColor: "#ea580c",
				title: "Developer Portfolio & Dashboard",
				description:
					"Interactive portfolio showcasing shipping web applications, open source experiments, and technical essays.",
				featureBoxes: [
					{ title: "80+", subtitle: "Projects & Tools" },
					{ title: "1,000+", subtitle: "GitHub Commits" },
					{ title: "19", subtitle: "Tech Articles" },
					{ title: "Full-Stack", subtitle: "Web & Systems" },
				],
				tags: [
					{ label: "TypeScript", color: "#3178c6" },
					{ label: "Python", color: "#3572a5" },
					{ label: "React", color: "#61dafb" },
					{ label: "Cloudflare", color: "#f38020" },
					{ label: "FastAPI", color: "#009688" },
				],
				footerRight: "https://tashif.codes",
			},
		},
		{
			out: join(OG_DIR, "resume.jpg"),
			data: {
				command: "cat resume.md",
				badge: "Resume",
				badgeColor: "#ea580c",
				title: "Tashif Ahmad Khan — Resume",
				description:
					"Software Developer & Full-Stack Engineer. Professional work experience, projects, education, and technical competencies.",
				featureBoxes: [
					{ title: "Full-Stack", subtitle: "TypeScript & React" },
					{ title: "Backend", subtitle: "Python, FastAPI, Go" },
					{ title: "Cloud", subtitle: "Cloudflare & D1/KV" },
					{ title: "Mobile", subtitle: "React Native & Expo" },
				],
				tags: [
					{ label: "TypeScript", color: "#3178c6" },
					{ label: "Python", color: "#3572a5" },
					{ label: "Go", color: "#00add8" },
					{ label: "React", color: "#61dafb" },
					{ label: "Next.js", color: "#ffffff" },
					{ label: "Cloudflare Workers", color: "#f38020" },
				],
				footerRight: "https://tashif.codes/resume",
			},
		},
		{
			out: join(OG_DIR, "projects.jpg"),
			data: {
				command: "ls -la ~/projects",
				badge: "Projects",
				badgeColor: "#8b5cf6",
				title: "All Projects & Open Source",
				description:
					"Interactive catalog of shipped web applications, developer utilities, Android applications, and open-source libraries.",
				featureBoxes: [
					{ title: "80+", subtitle: "Repositories", color: "#a78bfa" },
					{ title: "Live", subtitle: "Deployed Apps", color: "#34d399" },
					{ title: "Mobile", subtitle: "Android Releases", color: "#38bdf8" },
					{ title: "Tools", subtitle: "CLI Utilities", color: "#f472b6" },
				],
				tags: [
					{ label: "TypeScript", color: "#3178c6" },
					{ label: "Python", color: "#3572a5" },
					{ label: "React Native", color: "#61dafb" },
					{ label: "FastAPI", color: "#009688" },
					{ label: "Cloudflare", color: "#f38020" },
				],
				footerRight: "https://tashif.codes/projects",
			},
		},
		{
			out: join(OG_DIR, "projects-stats.jpg"),
			data: {
				command: "git stats --projects",
				badge: "Project Stats",
				badgeColor: "#a855f7",
				title: "Projects Analytics & Metrics",
				description:
					"Codebase statistics, language distribution, repository volume, and contribution velocity across projects.",
				featureBoxes: [
					{ title: "Languages", subtitle: "Byte Breakdown", color: "#c084fc" },
					{ title: "Stars", subtitle: "Community Stargazers", color: "#f59e0b" },
					{ title: "Forks", subtitle: "Contributions", color: "#10b981" },
					{ title: "80+ Repos", subtitle: "Analyzed", color: "#38bdf8" },
				],
				tags: [
					{ label: "Analytics", color: "#a855f7" },
					{ label: "Linguist", color: "#38bdf8" },
					{ label: "GitHub API", color: "#ffffff" },
					{ label: "Metrics", color: "#34d399" },
				],
				footerRight: "https://tashif.codes/projects/stats",
			},
		},
		{
			out: join(OG_DIR, "github.jpg"),
			data: {
				command: "gh profile view @tashifkhan",
				badge: "GitHub",
				badgeColor: "#3b82f6",
				title: "GitHub Activity & Open Source",
				description:
					"Public open-source contributions, commit history, repository developments, and pull requests by Tashif Ahmad Khan.",
				featureBoxes: [
					{ title: "1,000+", subtitle: "Total Commits", color: "#60a5fa" },
					{ title: "80+", subtitle: "Repositories", color: "#34d399" },
					{ title: "Active", subtitle: "Commit Streaks", color: "#fbbf24" },
					{ title: "@tashifkhan", subtitle: "Primary Handle", color: "#c084fc" },
				],
				tags: [
					{ label: "Open Source", color: "#60a5fa" },
					{ label: "Commits", color: "#34d399" },
					{ label: "Pull Requests", color: "#a78bfa" },
					{ label: "Git", color: "#f97316" },
				],
				footerRight: "https://tashif.codes/github",
			},
		},
		{
			out: join(OG_DIR, "github-stats.jpg"),
			data: {
				command: "gh stats --aggregated",
				badge: "GitHub Stats",
				badgeColor: "#38bdf8",
				title: "GitHub Detailed Analytics",
				description:
					"Aggregated commit history, pull request stats, contribution streaks, and language velocity across accounts.",
				featureBoxes: [
					{ title: "Multi-Account", subtitle: "Aggregated Stats", color: "#38bdf8" },
					{ title: "History", subtitle: "Commit Graph", color: "#34d399" },
					{ title: "PRs", subtitle: "Collaboration", color: "#fbbf24" },
					{ title: "Linguist", subtitle: "Code Share", color: "#c084fc" },
				],
				tags: [
					{ label: "Analytics", color: "#38bdf8" },
					{ label: "Contribution Graph", color: "#34d399" },
					{ label: "Code Velocity", color: "#f59e0b" },
				],
				footerRight: "https://tashif.codes/github/stats",
			},
		},
		{
			out: join(OG_DIR, "leetcode.jpg"),
			data: {
				command: "leetcode profile",
				badge: "LeetCode",
				badgeColor: "#f59e0b",
				title: "LeetCode Solutions & Profiles",
				description:
					"Algorithmic problem solving, data structure implementations, and competitive contest ratings by Tashif Ahmad Khan.",
				featureBoxes: [
					{ title: "Easy", subtitle: "Fundamental Patterns", color: "#34d399" },
					{ title: "Medium", subtitle: "DP & Graph Search", color: "#fbbf24" },
					{ title: "Hard", subtitle: "Advanced Systems", color: "#f87171" },
					{ title: "Contests", subtitle: "Global Ratings", color: "#60a5fa" },
				],
				tags: [
					{ label: "Algorithms", color: "#f59e0b" },
					{ label: "Data Structures", color: "#60a5fa" },
					{ label: "Python", color: "#3572a5" },
					{ label: "C++", color: "#f34b7d" },
				],
				footerRight: "https://tashif.codes/leetcode",
			},
		},
		{
			out: join(OG_DIR, "leetcode-stats.jpg"),
			data: {
				command: "leetcode stats --detailed",
				badge: "LeetCode Stats",
				badgeColor: "#eab308",
				title: "LeetCode Detailed Analytics",
				description:
					"Problem difficulty breakdown, submission accuracy, contest ratings, and topic distribution analysis.",
				featureBoxes: [
					{ title: "Breakdown", subtitle: "Easy · Med · Hard", color: "#fde047" },
					{ title: "Contest", subtitle: "Rating Metrics", color: "#60a5fa" },
					{ title: "Streak", subtitle: "Daily Discipline", color: "#34d399" },
					{ title: "Topics", subtitle: "Algorithms & Trees", color: "#c084fc" },
				],
				tags: [
					{ label: "LeetCode API", color: "#eab308" },
					{ label: "Metrics", color: "#38bdf8" },
					{ label: "Algorithms", color: "#34d399" },
				],
				footerRight: "https://tashif.codes/leetcode/stats",
			},
		},
		{
			out: join(OG_DIR, "connect.jpg"),
			data: {
				command: "finger tashif@tashif.codes",
				badge: "Connect",
				badgeColor: "#10b981",
				title: "Connect & Collaborate",
				description:
					"Developer profiles, open source collaborations, social links, and communication channels with Tashif Ahmad Khan.",
				featureBoxes: [
					{ title: "GitHub", subtitle: "@tashifkhan", color: "#60a5fa" },
					{ title: "LinkedIn", subtitle: "in/tashifkhan", color: "#38bdf8" },
					{ title: "Twitter / X", subtitle: "@tashifcodes", color: "#ffffff" },
					{ title: "Email", subtitle: "me@taf.sh", color: "#34d399" },
				],
				tags: [
					{ label: "Open Source", color: "#60a5fa" },
					{ label: "Software Engineering", color: "#34d399" },
					{ label: "Collaborations", color: "#c084fc" },
				],
				footerRight: "https://tashif.codes/connect",
			},
		},
		{
			out: join(OG_DIR, "docs.jpg"),
			data: {
				command: "man tashif.codes",
				badge: "Documentation",
				badgeColor: "#06b6d4",
				title: "Technical Documentation",
				description:
					"Comprehensive architectural guides, API references, deployment walkthroughs, and system design specifications.",
				featureBoxes: [
					{ title: "11 Projects", subtitle: "Architecture Manuals", color: "#38bdf8" },
					{ title: "Architecture", subtitle: "System Diagrams", color: "#34d399" },
					{ title: "API Reference", subtitle: "Endpoints & Models", color: "#a78bfa" },
					{ title: "Guides", subtitle: "Setup & Deployment", color: "#f59e0b" },
				],
				tags: [
					{ label: "Architecture", color: "#38bdf8" },
					{ label: "System Design", color: "#34d399" },
					{ label: "API Reference", color: "#a78bfa" },
					{ label: "Open Source", color: "#f59e0b" },
				],
				footerRight: "https://tashif.codes/docs",
			},
		},
		{
			out: join(OG_DIR, "fdroid.jpg"),
			data: {
				command: "fdroid repo update",
				badge: "F-Droid",
				badgeColor: "#10b981",
				title: "F-Droid Android Repository",
				description:
					"Direct APK package repository, verified release signatures, and open-source Android utilities by Tashif Ahmad Khan.",
				featureBoxes: [
					{ title: "F-Droid", subtitle: "Official Repo", color: "#34d399" },
					{ title: "Verified APKs", subtitle: "Release Signatures", color: "#38bdf8" },
					{ title: "Open Source", subtitle: "GPL & MIT Apps", color: "#a78bfa" },
					{ title: "Auto Builds", subtitle: "GitHub Actions", color: "#f59e0b" },
				],
				tags: [
					{ label: "Android", color: "#34d399" },
					{ label: "F-Droid", color: "#38bdf8" },
					{ label: "Open Source", color: "#a78bfa" },
					{ label: "Kotlin", color: "#a97bff" },
				],
				footerRight: "https://tashif.codes/fdroid",
			},
		},
		{
			out: join(OG_DIR, "blog.jpg"),
			data: {
				command: "cat /blog/index",
				badge: "Blog",
				badgeColor: "#f97316",
				title: "Engineering Blog & Technical Notes",
				description:
					"Deep-dives into systems engineering, browser internals, web performance, and open source architectures.",
				featureBoxes: [
					{ title: "19 Posts", subtitle: "Technical Articles", color: "#fb923c" },
					{ title: "Web Perf", subtitle: "Core Web Vitals", color: "#38bdf8" },
					{ title: "Browsers", subtitle: "Rendering & SSR", color: "#34d399" },
					{ title: "Languages", subtitle: "Python & TypeScript", color: "#c084fc" },
				],
				tags: [
					{ label: "Web Performance", color: "#38bdf8" },
					{ label: "Systems", color: "#f97316" },
					{ label: "Architecture", color: "#34d399" },
					{ label: "Open Source", color: "#c084fc" },
				],
				footerRight: "https://tashif.codes/blog",
			},
		},
	];

	for (const card of coreCards) {
		const svg = generateSiteOgSvg(card.data);
		const bytes = await rasterizeSvg(svg, card.out, fontFiles);
		console.log(
			`[og] ${card.out.replace(OG_DIR, "")} (${(bytes / 1024).toFixed(1)} KB)`,
		);
	}
}

async function generateProjectCards(fontFiles) {
	await mkdir(PROJECTS_OUT_DIR, { recursive: true });
	let repos = [];
	const cachedReposPath = join(ROOT, ".cache", "github", "stats-repos-tashifkhan.json");

	if (existsSync(cachedReposPath)) {
		try {
			repos = JSON.parse(readFileSync(cachedReposPath, "utf8"));
		} catch (e) {
			console.warn(`[og] warning reading ${cachedReposPath}: ${e.message}`);
		}
	}

	if (!repos.length) {
		console.log("[og] no cached repos found for project cards, skipping dynamic projects");
		return;
	}

	for (const p of repos) {
		const slug = (p.title || "").toLowerCase();
		if (!slug) continue;
		const outPath = join(PROJECTS_OUT_DIR, `${slug}.jpg`);

		const primaryLang = (p.languages && p.languages[0]) || "Code";
		const langColor = getLanguageColor(primaryLang);
		const stars = p.stars ?? 0;
		const forks = p.forks ?? 0;
		const topics = (p.topics || []).slice(0, 5);

		const featureBoxes = [
			{ title: primaryLang, subtitle: "Primary Language", color: langColor },
		];
		if (stars > 0) {
			featureBoxes.push({
				title: `${stars}`,
				subtitle: stars === 1 ? "GitHub Star" : "GitHub Stars",
				color: "#f59e0b",
			});
		}
		if (forks > 0) {
			featureBoxes.push({
				title: `${forks}`,
				subtitle: forks === 1 ? "Fork" : "Forks",
				color: "#10b981",
			});
		}
		if (p.releases && p.releases.length > 0) {
			const latest = p.releases[0]?.tag_name || `v${p.releases.length}.0`;
			featureBoxes.push({
				title: latest,
				subtitle: "Latest Release",
				color: "#a855f7",
			});
		} else if (p.num_commits) {
			featureBoxes.push({
				title: `${p.num_commits}`,
				subtitle: "Total Commits",
				color: "#38bdf8",
			});
		}

		const tags = topics.map((t) => ({ label: t.replace(/-/g, " ") }));
		const art = projectArt(slug);

		const svg = generateSiteOgSvg({
			badge: "Projects",
			title: projectOverrides[slug]?.title ?? formatTitle(p.title),
			description:
				landingTagline(slug) ||
				p.description ||
				`Open source ${primaryLang} software by Tashif Ahmad Khan.`,
			featureBoxes,
			tags,
			footerRight: `https://tashif.codes/projects/${slug}`,
			art: Boolean(art),
		});

		try {
			const bytes = await rasterizeSvg(
				svg,
				outPath,
				fontFiles,
				"DM Sans",
				art ? [await artLayer(art)] : [],
			);
			console.log(`[og] /projects/${slug}.jpg (${(bytes / 1024).toFixed(1)} KB)`);
		} catch (err) {
			console.warn(`[og] failed project card ${slug}: ${err.message}`);
		}
	}
}

async function generateDocsCards(fontFiles) {
	await mkdir(DOCS_OUT_DIR, { recursive: true });
	const docsDir = join(ROOT, "src", "data", "docs");
	if (!existsSync(docsDir)) return;

	const docs = readdirSync(docsDir, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name);

	for (const doc of docs) {
		const slug = doc.toLowerCase();
		const outPath = join(DOCS_OUT_DIR, `${slug}.jpg`);
		const title = formatTitle(doc);

		const svg = generateSiteOgSvg({
			command: `man ${slug}`,
			badge: "Docs",
			badgeColor: "#06b6d4",
			title: `${title} Documentation`,
			description: `Technical specifications, architecture diagrams, installation manuals, and API reference for ${title}.`,
			featureBoxes: [
				{ title: "Architecture", subtitle: "System Design", color: "#22d3ee" },
				{ title: "API Reference", subtitle: "Endpoints & Protocols", color: "#38bdf8" },
				{ title: "Setup Guide", subtitle: "Deployment Manual", color: "#34d399" },
				{ title: "Components", subtitle: "Internal Specs", color: "#c084fc" },
			],
			tags: [
				{ label: "Technical Docs", color: "#06b6d4" },
				{ label: "Architecture", color: "#38bdf8" },
				{ label: "API Reference", color: "#34d399" },
			],
			footerRight: `https://tashif.codes/docs/${slug}`,
		});

		try {
			const bytes = await rasterizeSvg(svg, outPath, fontFiles);
			console.log(`[og] /docs/${slug}.jpg (${(bytes / 1024).toFixed(1)} KB)`);
		} catch (err) {
			console.warn(`[og] failed doc card ${slug}: ${err.message}`);
		}
	}
}

async function generateDownloadCards(fontFiles) {
	await mkdir(DOWNLOAD_OUT_DIR, { recursive: true });
	const downloadsFile = join(ROOT, "src", "data", "downloads.json");
	if (!existsSync(downloadsFile)) return;

	try {
		const data = JSON.parse(readFileSync(downloadsFile, "utf8"));
		for (const proj of data.projects || []) {
			const title = proj.title;
			if (!title) continue;
			const outPath = join(DOWNLOAD_OUT_DIR, `${encodeURIComponent(title)}.jpg`);
			const formatted = formatTitle(title);

			const svg = generateSiteOgSvg({
				command: `curl -LO releases/${title}`,
				badge: "Download",
				badgeColor: "#ec4899",
				title: `Download ${formatted}`,
				description: `Official binary releases, verified APK installers, and package artifacts for ${formatted}.`,
				featureBoxes: [
					{ title: "Official Build", subtitle: "Verified Binary", color: "#f472b6" },
					{ title: "GitHub Release", subtitle: "Tagged Artifact", color: "#60a5fa" },
					{ title: "Open Source", subtitle: "Reproducible Build", color: "#34d399" },
				],
				tags: [
					{ label: "Release Artifact", color: "#ec4899" },
					{ label: "Direct Download", color: "#60a5fa" },
				],
				footerRight: `https://tashif.codes/download/${encodeURIComponent(title)}`,
			});

			const bytes = await rasterizeSvg(svg, outPath, fontFiles);
			console.log(`[og] /download/${title}.jpg (${(bytes / 1024).toFixed(1)} KB)`);
		}
	} catch (e) {
		console.warn(`[og] failed generating download cards: ${e.message}`);
	}
}

async function fetchBlogPosts() {
	const res = await fetch(`${BLOG_API}/posts.json`);
	if (!res.ok) {
		throw new Error(`Failed to fetch posts.json: ${res.status}`);
	}
	const data = await res.json();
	if (!Array.isArray(data)) {
		throw new Error("posts.json was not an array");
	}
	return data;
}

async function generateBlogCovers(fontFiles) {
	await mkdir(BLOG_OUT_DIR, { recursive: true });
	let posts;
	try {
		posts = await fetchBlogPosts();
	} catch (err) {
		console.warn(`[og] skip blog covers — could not load posts: ${err.message}`);
		return;
	}

	let wrote = 0;
	let skipped = 0;
	let failed = 0;

	for (const post of posts) {
		const slug = post?.slug;
		if (!slug) continue;

		const cover =
			(typeof post.coverImage === "string" && post.coverImage) ||
			(typeof post.metadata?.coverImage === "string" &&
				post.metadata.coverImage) ||
			null;
		const coverUrl = resolveCoverUrl(cover);
		const outPath = join(BLOG_OUT_DIR, `${slug}.jpg`);

		if (!coverUrl) {
			skipped++;
			continue;
		}

		if (RASTER_EXT.test(coverUrl) && !SVG_EXT.test(coverUrl)) {
			skipped++;
			continue;
		}

		if (!SVG_EXT.test(coverUrl)) {
			skipped++;
			continue;
		}

		try {
			const res = await fetch(coverUrl);
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}`);
			}
			const svgText = await res.text();
			const bytes = await rasterizeSvg(svgText, outPath, fontFiles, "Anton");
			wrote++;
			console.log(`[og] /blog/${slug}.jpg (${(bytes / 1024).toFixed(1)} KB)`);
		} catch (err) {
			failed++;
			const kept = await exists(outPath);
			console.warn(
				`[og] failed /blog/${slug}: ${err.message}${kept ? " (kept previous)" : ""}`,
			);
		}
	}

	// Drop stale PNGs from earlier generator so they are not served by mistake
	try {
		for (const name of await readdir(BLOG_OUT_DIR)) {
			if (name.endsWith(".png")) {
				const { unlink } = await import("node:fs/promises");
				await unlink(join(BLOG_OUT_DIR, name));
				console.log(`[og] removed stale ${name}`);
			}
		}
	} catch {
		// ignore
	}

	console.log(`[og] blog covers done — wrote ${wrote}, skipped ${skipped}, failed ${failed}`);
}

async function main() {
	await mkdir(OG_DIR, { recursive: true });
	const fontFiles = await collectFontFiles();
	console.log(
		`[og] loaded fonts (${fontFiles.length}):`,
		fontFiles.map((f) => f.split("/").pop()).join(", ") || "(system only)",
	);

	console.log("[og] generating core route cards...");
	await generateCoreCards(fontFiles);

	console.log("[og] generating project cards...");
	await generateProjectCards(fontFiles);

	console.log("[og] generating docs cards...");
	await generateDocsCards(fontFiles);

	console.log("[og] generating download cards...");
	await generateDownloadCards(fontFiles);

	console.log("[og] generating blog post covers...");
	await generateBlogCovers(fontFiles);

	console.log("[og] all social share thumbnails complete!");
}

main().catch((err) => {
	console.error("[og] fatal error:", err);
	process.exit(1);
});
