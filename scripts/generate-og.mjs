#!/usr/bin/env bun
/**
 * Rasterize blog cover SVGs → JPEG for Open Graph / WhatsApp / Telegram /
 * iMessage / Signal / X / Discord.
 *
 * Crawlers ignore SVG for og:image. A PNG without an sRGB profile (or with a
 * flaky alpha channel) often gets dropped too — Discord then shows a dark
 * title-only card. We emit opaque sRGB JPEGs at 1200×630.
 *
 * Runs as `prebuild` so Vercel/CI always ships fresh social images.
 */
import { mkdir, writeFile, access, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "og", "blog");
const FONT_DIR = join(ROOT, "scripts", "fonts");
const BLOG_API =
	process.env.BLOG_API_BASE ?? "https://blog.tashif.codes/api";
const BLOG_ORIGIN = new URL(BLOG_API).origin;

const RASTER_EXT = /\.(png|jpe?g|webp|gif)$/i;
const SVG_EXT = /\.svg$/i;

/** Map authoring stacks → fonts we ship (or find on the build machine). */
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
	// macOS extras when present (local builds)
	for (const extra of [
		"/System/Library/Fonts/Supplemental/Impact.ttf",
		"/System/Library/Fonts/Supplemental/Arial Black.ttf",
	]) {
		if (await exists(extra)) files.push(extra);
	}
	return files;
}

async function fetchPosts() {
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

async function rasterizeSvg(svgText, outPath, fontFiles) {
	const svg = remapFonts(svgText);
	const resvg = new Resvg(svg, {
		fitTo: { mode: "width", value: 1200 },
		background: "#ffffff",
		font: {
			loadSystemFonts: true,
			fontFiles,
			defaultFontFamily: "Anton",
		},
	});
	const rendered = resvg.render();
	// Force exact 1200×630 canvas (covers are authored at that size).
	const png = rendered.asPng();
	const jpeg = await sharp(png)
		.resize(1200, 630, { fit: "fill" })
		.flatten({ background: "#ffffff" })
		.jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: "4:4:4" })
		.toColorspace("srgb")
		.toBuffer();
	await mkdir(dirname(outPath), { recursive: true });
	await writeFile(outPath, jpeg);
	return jpeg.byteLength;
}

async function main() {
	await mkdir(OUT_DIR, { recursive: true });
	const fontFiles = await collectFontFiles();
	console.log(`[og] fonts (${fontFiles.length}):`, fontFiles.map((f) => f.split("/").pop()).join(", ") || "(system only)");

	let posts;
	try {
		posts = await fetchPosts();
	} catch (err) {
		console.warn(`[og] skip generate — could not load posts: ${err.message}`);
		process.exit(0);
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
		const outPath = join(OUT_DIR, `${slug}.jpg`);

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
			const bytes = await rasterizeSvg(svgText, outPath, fontFiles);
			wrote++;
			console.log(`[og] ${slug}.jpg (${(bytes / 1024).toFixed(1)} KB)`);
		} catch (err) {
			failed++;
			const kept = await exists(outPath);
			console.warn(
				`[og] failed ${slug}: ${err.message}${kept ? " (kept previous)" : ""}`,
			);
		}
	}

	// Drop stale PNGs from the earlier generator so they are not served by mistake.
	try {
		for (const name of await readdir(OUT_DIR)) {
			if (name.endsWith(".png")) {
				const { unlink } = await import("node:fs/promises");
				await unlink(join(OUT_DIR, name));
				console.log(`[og] removed stale ${name}`);
			}
		}
	} catch {
		// ignore
	}

	console.log(
		`[og] done — wrote ${wrote}, skipped ${skipped}, failed ${failed}`,
	);
}

main().catch((err) => {
	console.error("[og] fatal:", err);
	process.exit(1);
});
