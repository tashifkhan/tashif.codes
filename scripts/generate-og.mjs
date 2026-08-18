#!/usr/bin/env bun
/**
 * Rasterize blog cover SVGs → PNG for Open Graph / Discord / Twitter.
 *
 * Crawlers (Discord, Slack, iMessage, LinkedIn, …) ignore SVG for og:image.
 * Covers on blog.tashif.codes are authored as 1200×630 SVG; this script writes
 * matching PNGs under public/og/blog/<slug>.png so link previews can show them.
 *
 * Runs as `prebuild` so Vercel/CI always ships fresh social images.
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "og", "blog");
const BLOG_API =
	process.env.BLOG_API_BASE ?? "https://blog.tashif.codes/api";
const BLOG_ORIGIN = new URL(BLOG_API).origin;

const RASTER_EXT = /\.(png|jpe?g|webp|gif)$/i;
const SVG_EXT = /\.svg$/i;

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

async function rasterizeSvg(svgText, outPath) {
	// Force 1200×630 — WhatsApp / Telegram / iMessage / X large-card canonical size.
	const resvg = new Resvg(svgText, {
		fitTo: { mode: "width", value: 1200 },
		font: { loadSystemFonts: false },
	});
	const png = resvg.render().asPng();
	await mkdir(dirname(outPath), { recursive: true });
	await writeFile(outPath, png);
	return png.byteLength;
}

async function main() {
	await mkdir(OUT_DIR, { recursive: true });

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
		const outPath = join(OUT_DIR, `${slug}.png`);

		if (!coverUrl) {
			skipped++;
			continue;
		}

		// Already a crawler-safe raster hosted elsewhere — no local copy needed.
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
			const bytes = await rasterizeSvg(svgText, outPath);
			wrote++;
			console.log(`[og] ${slug}.png (${(bytes / 1024).toFixed(1)} KB)`);
		} catch (err) {
			failed++;
			const kept = await exists(outPath);
			console.warn(
				`[og] failed ${slug}: ${err.message}${kept ? " (kept previous)" : ""}`,
			);
		}
	}

	console.log(
		`[og] done — wrote ${wrote}, skipped ${skipped}, failed ${failed}`,
	);
}

main().catch((err) => {
	console.error("[og] fatal:", err);
	process.exit(1);
});
