import type { RepoRelease } from "@/types";

/** URL segment for a release tag. Tags are usually `v1.2.3` already. */
export function releaseSlug(tag: string): string {
	return tag.replace(/[^A-Za-z0-9._-]+/g, "-");
}

export function releaseHref(projectSlug: string, tag: string): string {
	return `/projects/${projectSlug}/releases/${releaseSlug(tag)}`;
}

/**
 * Release bodies usually open with "# Name vX.Y.Z", which repeats the page
 * header. Drop that first heading so the notes start with real content.
 */
export function releaseNotesBody(body: string, name: string | null, tag: string): string {
	const lines = body.replace(/\r\n/g, "\n").split("\n");
	const first = lines.findIndex((l) => l.trim() !== "");
	if (first === -1) return body;
	const match = lines[first].match(/^#{1,2}\s+(.+?)\s*#*\s*$/);
	if (!match) return body;
	const heading = match[1].toLowerCase();
	const dup =
		heading.includes(tag.toLowerCase()) ||
		(name != null && heading === name.trim().toLowerCase());
	return dup ? lines.slice(first + 1).join("\n").trim() : body;
}

/** First plain paragraph of the notes, for one-line previews. */
export function releaseSummary(body: string | null): string {
	if (!body) return "";
	for (const raw of body.replace(/\r\n/g, "\n").split("\n")) {
		const line = raw.trim();
		if (!line || /^(#|[-*+]\s|\d+\.\s|>|\||```|<|!\[)/.test(line)) continue;
		return line
			.replace(/!\[[^\]]*\]\([^)]*\)/g, "")
			.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
			.replace(/[*_`]/g, "")
			.trim();
	}
	return "";
}

export interface ReleaseMix {
	features: number;
	fixes: number;
	internal: number;
	total: number;
}

const SKIP = /install|verify|package|earlier releases|how to use|download|checksum/i;
const FIX = /fix|bug/i;
const INTERNAL = /under the hood|security|internal|chore|technical|refactor|build|\bci\b|dependenc/i;

/** Count bullets per kind, using the section heading each bullet sits under. */
export function releaseMix(body: string | null): ReleaseMix {
	const mix = { features: 0, fixes: 0, internal: 0, total: 0 };
	if (!body) return mix;
	let kind: "features" | "fixes" | "internal" | null = "features";
	let fenced = false;
	for (const line of body.replace(/\r\n/g, "\n").split("\n")) {
		if (line.trim().startsWith("```")) fenced = !fenced;
		if (fenced) continue;
		const heading = line.match(/^#{1,4}\s+(.+)/);
		if (heading) {
			const h = heading[1];
			kind = SKIP.test(h) ? null : FIX.test(h) ? "fixes" : INTERNAL.test(h) ? "internal" : "features";
			continue;
		}
		// Top-level bullets only; nested ones belong to their parent.
		if (kind && /^[-*+]\s+\S/.test(line)) {
			mix[kind]++;
			mix.total++;
		}
	}
	return mix;
}

export function releaseDownloads(release: Pick<RepoRelease, "assets">): number {
	return release.assets.reduce((sum, a) => sum + a.download_count, 0);
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatReleaseDate(dateStr: string | null): string {
	if (!dateStr) return "";
	return new Date(dateStr).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}
