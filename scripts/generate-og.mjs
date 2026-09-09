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

function generateSiteOgSvg({
	category = "SOFTWARE DEVELOPER · FULL-STACK & SYSTEMS",
	command = "cat profile.json",
	badge = "PORTFOLIO",
	badgeColor = "#ea580c",
	title = "Tashif Ahmad Khan",
	description = "Personal dashboard, open source projects, engineering blog, and developer tools.",
	featureBoxes = [],
	tags = [],
	footerRight = "https://tashif.codes",
}) {
	const titleLines = wrapText(title, 34, 2);
	const titleFontSize = titleLines.length > 1 || title.length > 24 ? 44 : 54;
	const titleY = titleLines.length > 1 ? 200 : 214;
	const descY = titleY + titleLines.length * (titleFontSize + 8) + 4;
	const descLines = wrapText(description, 68, 2);

	const numBoxes = Math.min(4, featureBoxes.length);
	let boxesSvg = "";
	if (numBoxes > 0) {
		const totalAvailableWidth = 1076;
		const gap = 16;
		const boxWidth = Math.floor(
			(totalAvailableWidth - (numBoxes - 1) * gap) / numBoxes,
		);
		boxesSvg = featureBoxes
			.slice(0, numBoxes)
			.map((box, i) => {
				const x = i * (boxWidth + gap);
				return `
      <g transform="translate(${x}, 0)">
        <rect width="${boxWidth}" height="88" rx="14" fill="#131b2e" fill-opacity="0.85" stroke="#ffffff" stroke-opacity="0.08" stroke-width="1"/>
        <text x="20" y="38" fill="${box.color || "#ffffff"}" font-family="DM Sans" font-size="28" font-weight="bold">${escapeXml(box.title)}</text>
        <text x="20" y="66" fill="#64748b" font-family="JetBrains Mono" font-size="12" font-weight="bold" letter-spacing="0.05em">${escapeXml(box.subtitle)}</text>
      </g>`;
			})
			.join("");
	}

	let tagX = 0;
	const tagsSvg = tags
		.slice(0, 6)
		.map((tag) => {
			const label = escapeXml(tag.label);
			const width = Math.max(70, Math.floor(label.length * 9.5 + 40));
			if (tagX + width > 1076) return "";
			const currentX = tagX;
			tagX += width + 12;
			const dotColor = tag.color || "#38bdf8";
			return `
      <g transform="translate(${currentX}, 0)">
        <rect width="${width}" height="32" rx="8" fill="#1e293b" fill-opacity="0.9" stroke="#334155" stroke-width="1"/>
        <circle cx="16" cy="16" r="4" fill="${dotColor}"/>
        <text x="28" y="21" fill="#e2e8f0" font-family="JetBrains Mono" font-size="12" font-weight="bold">${label}</text>
      </g>`;
		})
		.join("");

	const badgeText = escapeXml(badge);
	const badgeWidth = Math.max(120, Math.floor(badgeText.length * 9 + 48));
	const badgeX = 1140 - badgeWidth;

	return `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0e17"/>
      <stop offset="100%" stop-color="#06080d"/>
    </linearGradient>
    <radialGradient id="brandGlow" cx="82%" cy="15%" r="65%">
      <stop offset="0%" stop-color="${badgeColor}" stop-opacity="0.22"/>
      <stop offset="50%" stop-color="${badgeColor}" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="${badgeColor}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="blueGlow" cx="12%" cy="88%" r="45%">
      <stop offset="0%" stop-color="#0284c7" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#0284c7" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.2" fill="#ffffff" fill-opacity="0.055"/>
    </pattern>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#brandGlow)"/>
  <rect width="1200" height="630" fill="url(#blueGlow)"/>
  <rect width="1200" height="630" fill="url(#dots)"/>

  <!-- Card Border -->
  <rect x="28" y="28" width="1144" height="574" rx="20" fill="#0d131f" fill-opacity="0.6" stroke="#ffffff" stroke-opacity="0.1" stroke-width="1.5"/>

  <!-- Top bar / Terminal window controls -->
  <circle cx="66" cy="66" r="6" fill="#ef4444"/>
  <circle cx="86" cy="66" r="6" fill="#f59e0b"/>
  <circle cx="106" cy="66" r="6" fill="#10b981"/>

  <text x="132" y="71" fill="#f97316" font-family="JetBrains Mono" font-size="14" font-weight="bold">taf@tashif.codes</text>
  <text x="262" y="71" fill="#475569" font-family="JetBrains Mono" font-size="14">%</text>
  <text x="280" y="71" fill="#94a3b8" font-family="JetBrains Mono" font-size="14">${escapeXml(command)}</text>

  <!-- Route Badge -->
  <g transform="translate(${badgeX}, 50)">
    <rect width="${badgeWidth}" height="32" rx="16" fill="${badgeColor}" fill-opacity="0.14" stroke="${badgeColor}" stroke-opacity="0.45" stroke-width="1"/>
    <circle cx="18" cy="16" r="4" fill="${badgeColor}"/>
    <text x="30" y="21" fill="#ffffff" font-family="JetBrains Mono" font-size="12" font-weight="bold" letter-spacing="0.06em">${badgeText}</text>
  </g>

  <!-- Divider line -->
  <line x1="28" y1="102" x2="1172" y2="102" stroke="#ffffff" stroke-opacity="0.08" stroke-width="1"/>

  <!-- Hero Content -->
  <text x="66" y="148" fill="${badgeColor}" font-family="JetBrains Mono" font-size="13" font-weight="bold" letter-spacing="0.14em">${escapeXml(category)}</text>

  <text x="66" y="${titleY}" fill="#ffffff" font-family="DM Sans" font-size="${titleFontSize}" font-weight="bold" letter-spacing="-0.02em">
    ${titleLines.map((line, idx) => `<tspan x="66" dy="${idx === 0 ? 0 : titleFontSize + 6}">${escapeXml(line)}</tspan>`).join("")}
  </text>

  <text x="66" y="${descY}" fill="#94a3b8" font-family="DM Sans" font-size="22" font-weight="bold">
    ${descLines.map((line, idx) => `<tspan x="66" dy="${idx === 0 ? 0 : 30}">${escapeXml(line)}</tspan>`).join("")}
  </text>

  ${boxesSvg ? `<g transform="translate(66, 344)">${boxesSvg}</g>` : ""}

  ${tagsSvg ? `<g transform="translate(66, ${boxesSvg ? 456 : 370})">${tagsSvg}</g>` : ""}

  <!-- Bottom Divider line -->
  <line x1="28" y1="528" x2="1172" y2="528" stroke="#ffffff" stroke-opacity="0.08" stroke-width="1"/>

  <!-- Footer -->
  <g transform="translate(66, 564)">
    <circle cx="14" cy="0" r="14" fill="#ea580c"/>
    <text x="14" y="5" text-anchor="middle" fill="#ffffff" font-family="DM Sans" font-size="12" font-weight="bold">TK</text>
    <text x="38" y="-1" fill="#ffffff" font-family="DM Sans" font-size="16" font-weight="bold">Tashif Ahmad Khan</text>
    <text x="38" y="16" fill="#64748b" font-family="JetBrains Mono" font-size="12">@tashifkhan</text>
  </g>

  <g transform="translate(1144, 564)">
    <text x="0" y="4" text-anchor="end" fill="#f97316" font-family="JetBrains Mono" font-size="15" font-weight="bold">${escapeXml(footerRight)}</text>
  </g>
</svg>
`;
}

async function rasterizeSvg(svgText, outPath, fontFiles, defaultFont = "DM Sans") {
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
				category: "SOFTWARE DEVELOPER · FULL-STACK & SYSTEMS",
				command: "cat profile.json",
				badge: "PORTFOLIO",
				badgeColor: "#ea580c",
				title: "Tashif Ahmad Khan",
				description:
					"Personal dashboard, open source projects, engineering blog, and developer tools.",
				featureBoxes: [
					{ title: "80+", subtitle: "PROJECTS & TOOLS" },
					{ title: "1,000+", subtitle: "GITHUB COMMITS" },
					{ title: "19", subtitle: "TECH ARTICLES" },
					{ title: "LeetCode", subtitle: "ALGORITHMS SOLVED" },
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
				category: "SOFTWARE DEVELOPER · FULL-STACK & SYSTEMS",
				command: "cat dashboard.json",
				badge: "DASHBOARD",
				badgeColor: "#ea580c",
				title: "Developer Portfolio & Dashboard",
				description:
					"Interactive portfolio showcasing shipping web applications, open source experiments, and technical essays.",
				featureBoxes: [
					{ title: "80+", subtitle: "PROJECTS & TOOLS" },
					{ title: "1,000+", subtitle: "GITHUB COMMITS" },
					{ title: "19", subtitle: "TECH ARTICLES" },
					{ title: "LeetCode", subtitle: "ALGORITHMS SOLVED" },
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
				category: "CURRICULUM VITAE & EXPERIENCE",
				command: "cat resume.md",
				badge: "RESUME / CV",
				badgeColor: "#ea580c",
				title: "Tashif Ahmad Khan — Resume",
				description:
					"Software Developer & Full-Stack Engineer. Professional work experience, projects, education, and technical competencies.",
				featureBoxes: [
					{ title: "Full-Stack", subtitle: "TYPESCRIPT & REACT" },
					{ title: "Backend", subtitle: "PYTHON, FASTAPI, GO" },
					{ title: "Cloud", subtitle: "CLOUDFLARE & D1/KV" },
					{ title: "Mobile", subtitle: "REACT NATIVE & EXPO" },
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
				category: "SOFTWARE & EXPERIMENTS CATALOG",
				command: "ls -la ~/projects",
				badge: "PROJECTS",
				badgeColor: "#8b5cf6",
				title: "All Projects & Open Source",
				description:
					"Interactive catalog of shipped web applications, developer utilities, Android applications, and open-source libraries.",
				featureBoxes: [
					{ title: "80+", subtitle: "REPOSITORIES", color: "#a78bfa" },
					{ title: "Live", subtitle: "DEPLOYED APPS", color: "#34d399" },
					{ title: "Mobile", subtitle: "ANDROID RELEASES", color: "#38bdf8" },
					{ title: "Tools", subtitle: "CLI UTILITIES", color: "#f472b6" },
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
				category: "CODEBASE & REPOSITORY METRICS",
				command: "git stats --projects",
				badge: "PROJECT STATS",
				badgeColor: "#a855f7",
				title: "Projects Analytics & Metrics",
				description:
					"Codebase statistics, language distribution, repository volume, and contribution velocity across projects.",
				featureBoxes: [
					{ title: "Languages", subtitle: "BYTE BREAKDOWN", color: "#c084fc" },
					{ title: "Stars", subtitle: "COMMUNITY ENGAGEMENT", color: "#f59e0b" },
					{ title: "Forks", subtitle: "CONTRIBUTIONS", color: "#10b981" },
					{ title: "80+ Repos", subtitle: "ANALYZED", color: "#38bdf8" },
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
				category: "OPEN SOURCE & CONTRIBUTIONS",
				command: "gh profile view @tashifkhan",
				badge: "GITHUB",
				badgeColor: "#3b82f6",
				title: "GitHub Activity & Open Source",
				description:
					"Public open-source contributions, commit history, repository developments, and pull requests by Tashif Ahmad Khan.",
				featureBoxes: [
					{ title: "1,000+", subtitle: "TOTAL COMMITS", color: "#60a5fa" },
					{ title: "80+", subtitle: "REPOSITORIES", color: "#34d399" },
					{ title: "Active", subtitle: "COMMIT STREAKS", color: "#fbbf24" },
					{ title: "@tashifkhan", subtitle: "PRIMARY HANDLE", color: "#c084fc" },
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
				category: "MULTI-ACCOUNT ACTIVITY ANALYTICS",
				command: "gh stats --aggregated",
				badge: "GITHUB STATS",
				badgeColor: "#38bdf8",
				title: "GitHub Detailed Analytics",
				description:
					"Aggregated commit history, pull request stats, contribution streaks, and language velocity across accounts.",
				featureBoxes: [
					{ title: "Multi-Account", subtitle: "AGGREGATED STATS", color: "#38bdf8" },
					{ title: "History", subtitle: "COMMIT GRAPH", color: "#34d399" },
					{ title: "PRs", subtitle: "COLLABORATION", color: "#fbbf24" },
					{ title: "Linguist", subtitle: "CODE SHARE", color: "#c084fc" },
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
				category: "DATA STRUCTURES & ALGORITHMS",
				command: "leetcode profile",
				badge: "LEETCODE",
				badgeColor: "#f59e0b",
				title: "LeetCode Solutions & Profiles",
				description:
					"Algorithmic problem solving, data structure implementations, and competitive contest ratings by Tashif Ahmad Khan.",
				featureBoxes: [
					{ title: "Easy", subtitle: "FUNDAMENTAL PATTERNS", color: "#34d399" },
					{ title: "Medium", subtitle: "DP & GRAPH SEARCH", color: "#fbbf24" },
					{ title: "Hard", subtitle: "ADVANCED SYSTEMS", color: "#f87171" },
					{ title: "Contests", subtitle: "GLOBAL RATINGS", color: "#60a5fa" },
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
				category: "PROBLEM SOLVING ANALYTICS",
				command: "leetcode stats --detailed",
				badge: "LEETCODE STATS",
				badgeColor: "#eab308",
				title: "LeetCode Detailed Analytics",
				description:
					"Problem difficulty breakdown, submission accuracy, contest ratings, and topic distribution analysis.",
				featureBoxes: [
					{ title: "Breakdown", subtitle: "EASY · MED · HARD", color: "#fde047" },
					{ title: "Contest", subtitle: "RATING METRICS", color: "#60a5fa" },
					{ title: "Streak", subtitle: "DAILY DISCIPLINE", color: "#34d399" },
					{ title: "Topics", subtitle: "DYNAMIC PROG & TREES", color: "#c084fc" },
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
				category: "GET IN TOUCH & SOCIALS",
				command: "finger tashif@tashif.codes",
				badge: "CONNECT",
				badgeColor: "#10b981",
				title: "Connect & Collaborate",
				description:
					"Developer profiles, open source collaborations, social links, and communication channels with Tashif Ahmad Khan.",
				featureBoxes: [
					{ title: "GitHub", subtitle: "@TASHIFKHAN", color: "#60a5fa" },
					{ title: "LinkedIn", subtitle: "IN/TASHIFKHAN", color: "#38bdf8" },
					{ title: "Twitter / X", subtitle: "@TASHIFCODES", color: "#ffffff" },
					{ title: "Email", subtitle: "TASHIF@DUCK.COM", color: "#34d399" },
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
				category: "SYSTEM MANUALS & ARCHITECTURE",
				command: "man tashif-docs",
				badge: "DOCUMENTATION",
				badgeColor: "#06b6d4",
				title: "Documentation Hub",
				description:
					"In-depth system architecture diagrams, setup guides, API specifications, and component manuals for projects.",
				featureBoxes: [
					{ title: "Architecture", subtitle: "SYSTEM DESIGN", color: "#22d3ee" },
					{ title: "API Reference", subtitle: "ENDPOINTS & SCHEMAS", color: "#38bdf8" },
					{ title: "Setup Guides", subtitle: "INSTALLATION", color: "#34d399" },
					{ title: "Pipelines", subtitle: "DATA FLOW", color: "#c084fc" },
				],
				tags: [
					{ label: "Technical Docs", color: "#06b6d4" },
					{ label: "Architecture", color: "#38bdf8" },
					{ label: "API Reference", color: "#34d399" },
				],
				footerRight: "https://tashif.codes/docs",
			},
		},
		{
			out: join(OG_DIR, "fdroid.jpg"),
			data: {
				category: "VERIFIED ANDROID APP REPOSITORY",
				command: "fdroid repo info",
				badge: "F-DROID",
				badgeColor: "#00b4ab",
				title: "Independent Android App Repository",
				description:
					"Verified, open-source Android APK builds signed with reproducible releases and Fastlane metadata.",
				featureBoxes: [
					{ title: "Delhi Metro", subtitle: "TRANSIT APP", color: "#2dd4bf" },
					{ title: "Patchwork", subtitle: "CALDAV TASKS", color: "#38bdf8" },
					{ title: "Sophos Mobile", subtitle: "AUTO-LOGIN", color: "#fbbf24" },
					{ title: "F-Droid", subtitle: "CLIENT REPO", color: "#34d399" },
				],
				tags: [
					{ label: "Android APK", color: "#00b4ab" },
					{ label: "Fastlane", color: "#2dd4bf" },
					{ label: "F-Droid Client", color: "#38bdf8" },
					{ label: "Signed Releases", color: "#34d399" },
				],
				footerRight: "https://tashif.codes/fdroid",
			},
		},
		{
			out: join(OG_DIR, "blog.jpg"),
			data: {
				category: "ENGINEERING WRITING & ESSAYS",
				command: "cat /blog/index",
				badge: "ARTICLES",
				badgeColor: "#f97316",
				title: "Engineering Blog & Technical Notes",
				description:
					"Deep-dives into systems engineering, browser internals, web performance, and open source architectures.",
				featureBoxes: [
					{ title: "19", subtitle: "TECH ARTICLES", color: "#fb923c" },
					{ title: "Web Perf", subtitle: "CORE WEB VITALS", color: "#38bdf8" },
					{ title: "Browsers", subtitle: "RENDERING & SSR", color: "#34d399" },
					{ title: "Languages", subtitle: "PYTHON & TS", color: "#c084fc" },
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
			{ title: primaryLang, subtitle: "PRIMARY LANGUAGE", color: langColor },
		];
		if (stars > 0) {
			featureBoxes.push({
				title: `★ ${stars}`,
				subtitle: stars === 1 ? "GITHUB STAR" : "GITHUB STARS",
				color: "#f59e0b",
			});
		}
		if (forks > 0) {
			featureBoxes.push({
				title: `⑂ ${forks}`,
				subtitle: forks === 1 ? "FORK" : "FORKS",
				color: "#10b981",
			});
		}
		if (p.releases && p.releases.length > 0) {
			const latest = p.releases[0]?.tag_name || `v${p.releases.length}.0`;
			featureBoxes.push({
				title: latest,
				subtitle: "LATEST RELEASE",
				color: "#a855f7",
			});
		} else if (p.num_commits) {
			featureBoxes.push({
				title: `${p.num_commits}`,
				subtitle: "TOTAL COMMITS",
				color: "#38bdf8",
			});
		}

		const tags = topics.map((t) => ({
			label: `#${t}`,
			color: langColor,
		}));

		const svg = generateSiteOgSvg({
			category: `OPEN SOURCE PROJECT · ${primaryLang.toUpperCase()}`,
			command: `git info ${slug}`,
			badge: "PROJECT",
			badgeColor: langColor !== "#94a3b8" ? langColor : "#3178c6",
			title: formatTitle(p.title),
			description:
				p.description ||
				`Open source ${primaryLang} software repository by Tashif Ahmad Khan.`,
			featureBoxes,
			tags,
			footerRight: `https://tashif.codes/projects/${slug}`,
		});

		try {
			const bytes = await rasterizeSvg(svg, outPath, fontFiles);
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
			category: "PROJECT DOCUMENTATION · ARCHITECTURE & GUIDES",
			command: `man ${slug}`,
			badge: "DOCS",
			badgeColor: "#06b6d4",
			title: `${title} Documentation`,
			description: `Technical specifications, architecture diagrams, installation manuals, and API reference for ${title}.`,
			featureBoxes: [
				{ title: "Architecture", subtitle: "SYSTEM DESIGN", color: "#22d3ee" },
				{ title: "API Reference", subtitle: "ENDPOINTS & PROTOCOLS", color: "#38bdf8" },
				{ title: "Setup Guide", subtitle: "DEPLOYMENT MANUAL", color: "#34d399" },
				{ title: "Components", subtitle: "INTERNAL SPECS", color: "#c084fc" },
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
				category: "SOFTWARE RELEASE · DIRECT DOWNLOAD",
				command: `curl -LO releases/${title}`,
				badge: "DOWNLOAD",
				badgeColor: "#ec4899",
				title: `Download ${formatted}`,
				description: `Official binary releases, verified APK installers, and package artifacts for ${formatted}.`,
				featureBoxes: [
					{ title: "Official Build", subtitle: "VERIFIED BINARY", color: "#f472b6" },
					{ title: "GitHub Release", subtitle: "TAGGED ARTIFACT", color: "#60a5fa" },
					{ title: "Open Source", subtitle: "REPRODUCIBLE", color: "#34d399" },
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
