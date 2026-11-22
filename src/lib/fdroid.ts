/**
 * Everything the site knows about the F-Droid repo, read at build time.
 *
 * Two sources:
 * - public/fdroid/repo/index-v1.json, the signed index CI commits. It holds
 *   the versions, sizes, hashes and permissions of each APK.
 * - public/fdroid/metadata, the listings written by hand: description,
 *   screenshots, video and "What's new" per version. The site reads these
 *   directly, so a listing edit shows here before the index is re-signed.
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { allProjects } from "../data/projects";
import { slugify } from "./slugify";

export const REPO_URL = "https://tashif.codes/fdroid/repo";

// SHA-256 of the repo signing certificate. F-Droid checks it when the repo is
// added, so a hijacked or swapped index is rejected. It only changes if the
// keystore is replaced, which would break every existing install anyway.
export const REPO_FINGERPRINT =
	"568557c435bdf555725de95de596a90d6fa964d4bf0b71874f254cd0be7e94c9";

export const REPO_ADD_URL = `${REPO_URL}?fingerprint=${REPO_FINGERPRINT}`;

const ROOT = path.resolve("public/fdroid");
const METADATA = path.join(ROOT, "metadata");

export interface FdroidVersion {
	name: string;
	code: number;
	sizeBytes: number;
	addedAt?: number;
	minSdk?: number;
	targetSdk?: number;
	abis: string[];
	apkUrl: string;
	sha256?: string;
	/** "What's new" for this version, when a changelog file exists. */
	notes?: DescriptionBlock[];
}

export type DescriptionBlock =
	| { kind: "heading"; text: string }
	| { kind: "paragraph"; text: string }
	| { kind: "list"; items: string[] };

export interface FdroidPermission {
	/** Plain-language label, e.g. "Read your text messages". */
	label: string;
	/** The Android name, e.g. android.permission.READ_SMS. */
	name: string;
}

export interface FdroidApp {
	/** URL segment under /fdroid. */
	slug: string;
	name: string;
	packageName: string;
	summary: string;
	description: DescriptionBlock[];
	license?: string;
	categories: string[];
	links: {
		website?: string;
		sourceCode?: string;
		issueTracker?: string;
		changelog?: string;
		/** The project's page on this site, when there is one. */
		project?: string;
	};
	icon?: string;
	featureGraphic?: string;
	screenshots: string[];
	wideScreenshots: string[];
	video?: { src: string; poster?: string };
	versions: FdroidVersion[];
	latest?: FdroidVersion;
	permissions: FdroidPermission[];
	updatedAt?: number;
}

export interface FdroidRepo {
	name: string;
	description: string;
	updatedAt?: number;
	apps: FdroidApp[];
}

/** Turns the listing's plain text into headings, paragraphs and lists. */
export function parseDescription(text: string): DescriptionBlock[] {
	const blocks: DescriptionBlock[] = [];
	for (const chunk of text.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
		const lines = chunk
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean);
		if (lines.length === 0) continue;
		if (lines.every((l) => /^[*-]\s+/.test(l))) {
			blocks.push({
				kind: "list",
				items: lines.map((l) => l.replace(/^[*-]\s+/, "")),
			});
		} else if (lines.length === 1 && lines[0].length < 40 && !/[.:]$/.test(lines[0])) {
			blocks.push({ kind: "heading", text: lines[0] });
		} else {
			blocks.push({ kind: "paragraph", text: lines.join(" ") });
		}
	}
	return blocks;
}

// What Android calls a permission, in the words its own settings screen uses.
// Anything not listed here is launcher or library plumbing and is left out.
const PERMISSION_LABELS: Record<string, string> = {
	"android.permission.READ_SMS": "Read your text messages",
	"android.permission.RECEIVE_SMS": "Receive text messages",
	"android.permission.RECORD_AUDIO": "Record audio",
	"android.permission.CAMERA": "Take pictures",
	"android.permission.READ_CALENDAR": "Read calendar events",
	"android.permission.WRITE_CALENDAR": "Add or change calendar events",
	"android.permission.INTERNET": "Full network access",
	"android.permission.ACCESS_NETWORK_STATE": "View network connections",
	"android.permission.POST_NOTIFICATIONS": "Show notifications",
	"android.permission.USE_BIOMETRIC": "Use biometric hardware",
	"android.permission.READ_EXTERNAL_STORAGE": "Read shared storage",
	"android.permission.WRITE_EXTERNAL_STORAGE": "Write to shared storage",
	"android.permission.READ_MEDIA_VISUAL_USER_SELECTED":
		"Read photos you select",
	"android.permission.FOREGROUND_SERVICE": "Run a foreground service",
	"android.permission.RECEIVE_BOOT_COMPLETED": "Run at startup",
	"android.permission.WAKE_LOCK": "Prevent the phone from sleeping",
	"android.permission.VIBRATE": "Control vibration",
	"android.permission.SYSTEM_ALERT_WINDOW": "Appear on top of other apps",
	"android.permission.MODIFY_AUDIO_SETTINGS": "Change audio settings",
};

function listFiles(dir: string, publicPrefix: string): string[] {
	if (!fs.existsSync(dir)) return [];
	return fs
		.readdirSync(dir)
		.filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
		.sort()
		.map((f) => `${publicPrefix}/${f}`);
}

function firstExisting(dir: string, names: string[], publicPrefix: string) {
	const hit = names.find((n) => fs.existsSync(path.join(dir, n)));
	return hit ? `${publicPrefix}/${hit}` : undefined;
}

function readText(file: string): string | undefined {
	return fs.existsSync(file) ? fs.readFileSync(file, "utf-8").trim() : undefined;
}

function loadRepo(): FdroidRepo {
	const repo: FdroidRepo = {
		name: "Tashif Codes",
		description: "Android apps published by Tashif Khan.",
		apps: [],
	};

	const indexPath = path.join(ROOT, "repo/index-v1.json");
	if (!fs.existsSync(indexPath)) return repo;

	let index: any;
	try {
		index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
	} catch {
		return repo;
	}

	repo.name = index.repo?.name ?? repo.name;
	repo.description = index.repo?.description ?? repo.description;
	repo.updatedAt = index.repo?.timestamp;

	repo.apps = (index.apps ?? [])
		.map((app: any): FdroidApp => {
			const pkg: string = app.packageName;
			const localDir = path.join(METADATA, pkg, "en-US");
			const localUrl = `/fdroid/metadata/${pkg}/en-US`;

			// The hand-written listing wins over whatever the index last captured.
			let meta: Record<string, any> = {};
			try {
				const file = path.join(METADATA, `${pkg}.yml`);
				if (fs.existsSync(file)) {
					meta = (yaml.load(fs.readFileSync(file, "utf-8")) as any) ?? {};
				}
			} catch {
				meta = {};
			}

			const versions: FdroidVersion[] = (index.packages?.[pkg] ?? [])
				.map((v: any): FdroidVersion => {
					const notes = readText(
						path.join(localDir, "changelogs", `${v.versionCode}.txt`),
					);
					return {
						name: v.versionName,
						code: Number(v.versionCode),
						sizeBytes: v.size,
						addedAt: v.added,
						minSdk: v.minSdkVersion ? Number(v.minSdkVersion) : undefined,
						targetSdk: v.targetSdkVersion
							? Number(v.targetSdkVersion)
							: undefined,
						abis: v.nativecode ?? [],
						apkUrl: `/fdroid/repo/${v.apkName}`,
						sha256: v.hashType === "sha256" ? v.hash : undefined,
						notes: notes ? parseDescription(notes) : undefined,
					};
				})
				.sort((a: FdroidVersion, b: FdroidVersion) => b.code - a.code);

			const latest =
				versions.find((v) => String(v.code) === String(app.suggestedVersionCode)) ??
				versions[0];

			const seen = new Set<string>();
			const permissions: FdroidPermission[] = [];
			const raw: [string, unknown][] =
				(index.packages?.[pkg] ?? []).find(
					(v: any) => Number(v.versionCode) === latest?.code,
				)?.["uses-permission"] ?? [];
			for (const [name] of raw) {
				const label = PERMISSION_LABELS[name];
				if (!label || seen.has(label)) continue;
				seen.add(label);
				permissions.push({ label, name });
			}

			const sourceCode: string | undefined = meta.SourceCode ?? app.sourceCode;
			const repoName = sourceCode?.split("/").filter(Boolean).pop() ?? "";
			const project = allProjects.find((p) => p.slug === slugify(repoName));
			// Billi and legacy Paisa use the same GitHub repo and project page.
			const slug = pkg === "sh.taf.billi" ? "billi" : project?.slug ?? slugify(meta.Name ?? app.name ?? pkg);

			const videoUrl = readText(path.join(localDir, "video.txt"));
			// Listings point at the production host. On the site, use the same
			// file by path so previews and local builds play it too.
			const videoSrc = videoUrl?.replace(/^https?:\/\/tashif\.codes/, "");
			const posterPath = videoSrc?.replace(/\.mp4$/, "-poster.webp");
			const poster =
				posterPath && fs.existsSync(path.resolve("public", `.${posterPath}`))
					? posterPath
					: undefined;

			return {
				slug,
				name: meta.Name ?? app.name ?? pkg,
				packageName: pkg,
				summary: meta.Summary ?? app.summary ?? "",
				description: parseDescription(meta.Description ?? app.description ?? ""),
				license: meta.License ?? app.license,
				categories: meta.Categories ?? app.categories ?? [],
				links: {
					website: meta.WebSite ?? app.webSite,
					sourceCode,
					issueTracker: meta.IssueTracker ?? app.issueTracker,
					changelog: meta.Changelog ?? app.changelog,
					project: project ? `/projects/${project.slug}` : undefined,
				},
				icon: firstExisting(localDir, ["icon.png"], localUrl),
				featureGraphic: firstExisting(
					localDir,
					["featureGraphic.jpg", "featureGraphic.png"],
					localUrl,
				),
				screenshots: listFiles(
					path.join(localDir, "phoneScreenshots"),
					`${localUrl}/phoneScreenshots`,
				),
				wideScreenshots: listFiles(
					path.join(localDir, "tenInchScreenshots"),
					`${localUrl}/tenInchScreenshots`,
				),
				video: videoSrc ? { src: videoSrc, poster } : undefined,
				versions,
				latest,
				permissions,
				updatedAt: app.lastUpdated,
			};
		})
		.sort((a: FdroidApp, b: FdroidApp) => a.name.localeCompare(b.name));

	return repo;
}

export const fdroidRepo: FdroidRepo = loadRepo();

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(ts: number): string {
	return new Date(ts).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

const SDK_TO_ANDROID: Record<number, string> = {
	21: "5.0",
	22: "5.1",
	23: "6.0",
	24: "7.0",
	25: "7.1",
	26: "8.0",
	27: "8.1",
	28: "9",
	29: "10",
	30: "11",
	31: "12",
	32: "12.1",
	33: "13",
	34: "14",
	35: "15",
	36: "16",
};

export function androidVersion(sdk: number): string {
	return SDK_TO_ANDROID[sdk] ? `Android ${SDK_TO_ANDROID[sdk]}` : `SDK ${sdk}`;
}
