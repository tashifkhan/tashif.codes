import { formatTitle } from "../utils/formatTitle";
import { getProjectEntry } from "../utils/docs";
import { slugify } from "../utils/slugify";
import fs from 'fs';
import path from 'path';

export interface ReleaseAsset {
    name: string;
    download_url: string;
    size: number;
    download_count: number;
    content_type: string | null;
    updated_at: string | null;
}

export interface RepoRelease {
    id: number;
    tag_name: string;
    name: string | null;
    body: string | null;
    url: string;
    draft: boolean;
    prerelease: boolean;
    created_at: string | null;
    published_at: string | null;
    assets: ReleaseAsset[];
}

export interface Project {
	title: string;
	description: string;
	languages: string[];
	/** GitHub repository topics/tags */
	topics?: string[];
	live_website_url?: string;
	github_link: string;
	readme: string;
	slug: string;
	// Optional metadata
	pinned?: boolean;
	stars?: number;
	forks?: number;
    docs_slug?: string | null;
    parentRepo?: string;
    originalRepo?: {
        name: string;
        full_name: string;
        owner: string;
        url: string;
    } | null;
    isFork?: boolean;
    contributors?: Contributor[];
    releases?: RepoRelease[];
}

export interface Contributor {
    login: string;
    avatar_url: string;
    html_url: string;
    contributions: number;
}

/**
 * The upstream stats API goes down periodically (500s), which used to collapse the
 * site to whatever the /pinned endpoint returned. Every remote payload is now
 * mirrored to disk on success and replayed when the live call fails.
 */
const CACHE_DIR = path.join(process.cwd(), ".cache", "github");

function readCache<T>(key: string): T | null {
	try {
		const file = path.join(CACHE_DIR, `${key}.json`);
		if (!fs.existsSync(file)) return null;
		return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
	} catch {
		return null;
	}
}

function writeCache(key: string, data: unknown): void {
	try {
		fs.mkdirSync(CACHE_DIR, { recursive: true });
		fs.writeFileSync(
			path.join(CACHE_DIR, `${key}.json`),
			JSON.stringify(data),
			"utf-8"
		);
	} catch {
		/* cache is best-effort */
	}
}

/** Unauthenticated GitHub allows 60 req/hr; use a token when the env has one. */
const GH_TOKEN =
	process.env.GITHUB_TOKEN ||
	process.env.GH_TOKEN ||
	process.env.PUBLIC_GITHUB_TOKEN ||
	"";
const GH_HEADERS: Record<string, string> = GH_TOKEN
	? { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json" }
	: { Accept: "application/vnd.github+json" };

async function fetchJsonCached<T>(
	url: string,
	key: string,
	init?: RequestInit
): Promise<T | null> {
	try {
		const res = await fetch(url, init);
		if (res.ok) {
			const data = (await res.json()) as T;
			writeCache(key, data);
			return data;
		}
		console.error(`Fetch failed (${res.status}) for ${url}`);
	} catch (e) {
		console.error(`Error fetching ${url}`, e);
	}
	const cached = readCache<T>(key);
	if (cached) console.warn(`Using cached payload for ${key}`);
	return cached;
}

async function fetchPinnedProjects(first = 6): Promise<Project[]> {
	try {
        // Reverted to only fetching tashifkhan's pinned projects
		const data = await fetchJsonCached<any[]>(
			`https://github-stats.tashif.codes/tashifkhan/pinned?first=${first}`,
			"stats-pinned-tashifkhan"
		);
		if (!Array.isArray(data)) return [];
		return (data as any[]).map((p) => ({
			title: formatTitle(p.name),
			description: p.description || "No description available.",
			languages: p.primary_language ? [p.primary_language] : [],
			topics: Array.isArray(p.topics) ? p.topics : [],
			github_link: p.url,
			readme: "", // Not provided by pinned endpoint
			slug: slugify(p.name),
			pinned: true,
			stars: p.stars,
			forks: p.forks,
			docs_slug: getProjectEntry(slugify(p.name))
		}));
	} catch (e) {
		console.error("Error fetching pinned projects", e);
		return [];
	}
}

interface RepoMeta {
	forkMap: Map<string, number>;
	/** repo name (lowercase) / full_name → GitHub topics */
	topicsMap: Map<string, string[]>;
	/** repo name (lowercase) / full_name → languages (fallback when the stats API returns none) */
	languageMap: Map<string, string[]>;
}

/**
 * Full language breakdown for a repo, ordered by bytes. Cached to disk because it
 * costs one API call per repo and rarely changes.
 */
async function fetchRepoLanguages(fullName: string): Promise<string[] | null> {
	const key = `gh-languages-${fullName.replace("/", "__").toLowerCase()}`;
	const cached = readCache<Record<string, number>>(key);
	if (cached) return Object.keys(cached);
	if (!GH_TOKEN) return null; // don't burn the 60/hr anonymous budget

	const data = await fetchJsonCached<Record<string, number>>(
		`https://api.github.com/repos/${fullName}/languages`,
		key,
		{ headers: GH_HEADERS }
	);
	if (!data || typeof data !== "object") return null;
	return Object.entries(data)
		.sort((a, b) => b[1] - a[1])
		.map(([lang]) => lang);
}

/** Resolve promises in batches so we never open 100 sockets at once. */
async function inBatches<T, R>(
	items: T[],
	size: number,
	fn: (item: T) => Promise<R>
): Promise<R[]> {
	const out: R[] = [];
	for (let i = 0; i < items.length; i += size) {
		out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
	}
	return out;
}

async function fetchRepoMeta(users: string[]): Promise<RepoMeta> {
	const forkMap = new Map<string, number>();
	const topicsMap = new Map<string, string[]>();
	const languageMap = new Map<string, string[]>();

	await Promise.all(users.map(async (user) => {
		try {
			const repos = await fetchJsonCached<any[]>(
				`https://api.github.com/users/${user}/repos?per_page=100&type=owner`,
				`gh-repos-${user}`,
				{ headers: GH_HEADERS }
			);
			if (!Array.isArray(repos)) return;

			repos.forEach((repo: any) => {
				const forks = repo.forks_count ?? repo.forks;
				const topics: string[] = Array.isArray(repo.topics)
					? repo.topics.filter((t: unknown): t is string => typeof t === "string")
					: [];

				if (typeof forks === "number") {
					if (repo.full_name) {
						forkMap.set(repo.full_name.toLowerCase(), forks);
					}
					if (repo.name) {
						forkMap.set(`${user}/${repo.name}`.toLowerCase(), forks);
						forkMap.set(repo.name.toLowerCase(), forks);
					}
				}

				if (topics.length > 0) {
					if (repo.full_name) {
						topicsMap.set(repo.full_name.toLowerCase(), topics);
					}
					if (repo.name) {
						topicsMap.set(`${user}/${repo.name}`.toLowerCase(), topics);
						topicsMap.set(repo.name.toLowerCase(), topics);
					}
				}

			});

			// Full language lists (bytes-ordered) for every repo, primary as fallback
			await inBatches(repos, 8, async (repo: any) => {
				if (!repo.full_name && !repo.name) return;
				const full = repo.full_name || `${user}/${repo.name}`;
				const languages =
					(await fetchRepoLanguages(full)) ??
					(typeof repo.language === "string" && repo.language
						? [repo.language]
						: []);
				if (languages.length === 0) return;
				languageMap.set(full.toLowerCase(), languages);
				if (repo.name) {
					languageMap.set(`${user}/${repo.name}`.toLowerCase(), languages);
					languageMap.set(repo.name.toLowerCase(), languages);
					languageMap.set(slugify(repo.name).toLowerCase(), languages);
				}
			});
		} catch (e) {
			console.error(`Error fetching repo meta for ${user}:`, e);
		}
	}));

	return { forkMap, topicsMap, languageMap };
}

/**
 * Last-resort repo list straight from GitHub, shaped like the stats API payload.
 * Keeps the grid populated when github-stats is 500ing. READMEs are filled in
 * separately via {@link fillMissingReadmes}.
 */
async function fetchReposFromGitHub(user: string): Promise<any[]> {
	const repos = await fetchJsonCached<any[]>(
		`https://api.github.com/users/${user}/repos?per_page=100&type=owner&sort=updated`,
		`gh-repos-${user}`,
		{ headers: GH_HEADERS }
	);
	if (!Array.isArray(repos)) return [];
	return repos.map((repo: any) => ({
		title: repo.name,
		description: repo.description,
		languages: [],
		topics: Array.isArray(repo.topics) ? repo.topics : [],
		live_website_url: repo.homepage || undefined,
		readme: "",
		stars: repo.stargazers_count ?? 0,
		forks: repo.forks_count ?? 0,
		is_fork: repo.fork ?? false,
		num_commits: 0,
	}));
}

/** Decode a GitHub Contents API base64 payload to UTF-8 markdown. */
function decodeGithubReadmeContent(contentB64: string | undefined | null): string {
	if (!contentB64) return "";
	try {
		const normalized = contentB64.replace(/\n/g, "");
		return Buffer.from(normalized, "base64").toString("utf-8");
	} catch {
		return "";
	}
}

/**
 * Fetch a single repo README from GitHub, disk-cached so rebuilds stay cheap.
 * The conventional raw README URL is tried first because it does not consume
 * the unauthenticated GitHub API quota shared by Vercel build machines. The
 * Contents API remains the fallback for repositories using another README
 * filename. Returns an empty string only when GitHub confirms no README exists
 * or neither source can be reached.
 */
async function fetchGithubReadme(fullName: string): Promise<string> {
	// v2 invalidates old negative cache entries created when an earlier build
	// was rate-limited and mistakenly treated the repo as undocumented.
	const key = `gh-readme-v2-${fullName.replace("/", "__").toLowerCase()}`;
	const cached = readCache<{ content?: string; empty?: boolean }>(key);
	if (cached) {
		if (cached.empty) return "";
		if (typeof cached.content === "string") return cached.content;
	}

	try {
		const rawUrl = `https://raw.githubusercontent.com/${fullName}/HEAD/README.md`;
		const rawRes = await fetch(rawUrl);
		if (rawRes.ok) {
			const markdown = await rawRes.text();
			if (markdown.trim()) {
				writeCache(key, { content: markdown });
				return markdown;
			}
		}

		// GitHub's README endpoint resolves alternate names/casing for us. Only
		// a 404 is a durable "no README" result; rate limits and transient errors
		// must never be written as an empty cache entry.
		const res = await fetch(
			`https://api.github.com/repos/${fullName}/readme`,
			{ headers: GH_HEADERS }
		);
		if (res.status === 404) {
			writeCache(key, { empty: true });
			return "";
		}
		if (!res.ok) {
			console.error(`README fetch failed (${res.status}) for ${fullName}`);
			return "";
		}
		const body = (await res.json()) as { content?: string };
		const markdown = decodeGithubReadmeContent(body.content);
		if (markdown) {
			writeCache(key, { content: markdown });
		} else {
			writeCache(key, { empty: true });
		}
		return markdown;
	} catch (e) {
		console.error(`Error fetching README for ${fullName}`, e);
		return "";
	}
}

/**
 * Backfill empty `readme` fields from the GitHub Contents API.
 * Used when the stats API is down, returns skeleton rows, or omits READMEs.
 */
async function fillMissingReadmes(
	repos: any[],
	owner = "tashifkhan"
): Promise<void> {
	const missing = repos.filter(
		(r) => r && typeof r === "object" && !(typeof r.readme === "string" && r.readme.trim())
	);
	if (missing.length === 0) return;

	// Cap unauthenticated fills; with a token cover the full list in batches.
	const limit = GH_TOKEN ? missing.length : Math.min(missing.length, 8);
	const targets = missing.slice(0, limit);

	await inBatches(targets, 6, async (repo) => {
		const name = repo.title || repo.name;
		if (!name || typeof name !== "string") return;
		const fullName =
			typeof repo.full_name === "string" && repo.full_name.includes("/")
				? repo.full_name
				: `${owner}/${name}`;
		const readme = await fetchGithubReadme(fullName);
		if (readme) repo.readme = readme;
	});
}

async function fetchAllProjects(): Promise<Project[]> {
	let repos: any[] =
		(await fetchJsonCached<any[]>(
			"https://github-stats.tashif.codes/tashifkhan/repos",
			"stats-repos-tashifkhan"
		)) ?? [];

	if (!Array.isArray(repos) || repos.length === 0) {
		console.warn(
			"Stats API returned no repos — falling back to the GitHub repo list"
		);
		repos = await fetchReposFromGitHub("tashifkhan");
	}

	// Stats API may 500 mid-build, return a warm cache with holes, or serve the
	// lite payload with some skeleton rows. Always backfill empty READMEs from
	// GitHub so project pages never show the empty terminal shell when a
	// README actually exists upstream.
	await fillMissingReadmes(repos, "tashifkhan");

	// Fetch stars from multiple users to support parent repo star counts
	const starMap = new Map<string, number>();
    // User requested "multiple stars api call" for these accounts
    const starSources = ['tashifkhan', 'codeblech', 'codelif'];
    // Fork counts + topics from GitHub (topics also come from Stats API when deployed)
    const repoMetaPromise = fetchRepoMeta(starSources);
    
	await Promise.all(starSources.map(async (user) => {
        const starsData = await fetchJsonCached<any>(
            `https://github-stats.tashif.codes/${user}/stars`,
            `stats-stars-${user}`
        );
        if (starsData?.repositories && Array.isArray(starsData.repositories)) {
            starsData.repositories.forEach((repo: any) => {
                // Map by name (lowercase for safety)
                // This allows looking up 'jsjiit' and finding the star count from the 'codeblech' fetch
                starMap.set(repo.name.toLowerCase(), repo.stars);
            });
        }
    }));

	// Fetch pinned in parallel / earlier
	const [pinnedProjects, { forkMap, topicsMap, languageMap }] = await Promise.all([
		fetchPinnedProjects(),
		repoMetaPromise,
	]);
	const pinnedNames = new Set(
		pinnedProjects.map((p) => p.title.toLowerCase().trim())
	);
	// The pinned endpoint still carries primary_language when /repos does not.
	pinnedProjects.forEach((p) => {
		if (p.languages.length && !languageMap.has(p.slug.toLowerCase())) {
			languageMap.set(p.slug.toLowerCase(), p.languages);
		}
	});

	// Map repos -> Project objects
    const FORK_MAPPINGS: Record<string, string> = {
        "jsjiit": "codeblech/jsjiit",
        "jportal": "codeblech/jportal",
        "pyjiit": "codelif/pyjiit",
    };

	// The stats API intermittently returns an empty languages array — fall back to
	// the repo's primary language from the GitHub API so cards never go blank.
	const resolveLanguages = (
		project: any,
		titleKey: string,
		parentRepo?: string
	): string[] => {
		const fromApi = Array.isArray(project.languages) ? project.languages : [];
		if (fromApi.length > 0) return fromApi;
		const fromGitHub =
			(parentRepo ? languageMap.get(parentRepo.toLowerCase()) : undefined) ??
			languageMap.get(`tashifkhan/${titleKey}`.toLowerCase()) ??
			languageMap.get(titleKey.toLowerCase()) ??
			languageMap.get(slugify(titleKey).toLowerCase());
		if (fromGitHub?.length) return fromGitHub;
		const primary =
			(typeof project.primary_language === "string"
				? project.primary_language
				: undefined) ??
			(typeof project.language === "string" ? project.language : undefined);
		return primary ? [primary] : [];
	};

	const resolveTopics = (
		project: any,
		titleKey: string,
		parentRepo?: string
	): string[] => {
		const fromApi = Array.isArray(project.topics) ? project.topics : [];
		if (fromApi.length > 0) return fromApi;
		return (
			(parentRepo ? topicsMap.get(parentRepo.toLowerCase()) : undefined) ??
			topicsMap.get(`tashifkhan/${titleKey}`.toLowerCase()) ??
			topicsMap.get(titleKey.toLowerCase()) ??
			[]
		);
	};

	const repoProjects: Project[] = repos.map((project: any) => {
		const titleFormatted = formatTitle(project.title);
		const isPinned = pinnedNames.has(titleFormatted.toLowerCase());
        const projectSlug = slugify(project.title);
        
        const originalRepo = project.original_repo ?? null;
        const parentRepo = originalRepo?.full_name || FORK_MAPPINGS[projectSlug] || FORK_MAPPINGS[project.title.toLowerCase()] || undefined;

		// Priority: Star map (parent if exists, else self) -> project.stars -> project.stargazers -> 0
		let stars = starMap.get(project.title.toLowerCase());
		
        if (stars === undefined) {
             // Fallback
             if (!parentRepo) {
                stars =
                    project.stars ??
                    project.stargazers ??
                    project.stargazers_count ??
                    0;
             } else {
                 stars = project.stars ?? 0;
             }
		}

		const forks =
			(parentRepo ? forkMap.get(parentRepo.toLowerCase()) : undefined) ??
			forkMap.get(`tashifkhan/${project.title}`.toLowerCase()) ??
			forkMap.get(project.title.toLowerCase()) ??
			project.forks ??
			project.forks_count ??
			0;
		return {
			title: titleFormatted,
			description: project.description || "No description available.",
			languages: resolveLanguages(project, project.title, parentRepo),
			topics: resolveTopics(project, project.title, parentRepo),
			live_website_url: project.live_website_url,
			github_link: `https://github.com/tashifkhan/${project.title}`,
			readme: project.readme,
			slug: projectSlug,
			pinned: isPinned,
			stars,
			forks,
            docs_slug: getProjectEntry(projectSlug),
            parentRepo,
            originalRepo,
            isFork: project.is_fork ?? project.fork ?? false,
            contributors: project.contributors,
            releases: project.releases || [],
		};
	});

	// Include any pinned repos not in the user's own repo list
	const existingSlugs = new Set(repoProjects.map((p) => p.slug));
	for (const pinned of pinnedProjects) {
		if (!existingSlugs.has(pinned.slug)) {
            // Apply star updates to pinned projects too if available
            const freshStars = starMap.get(pinned.title.toLowerCase());
            if (freshStars !== undefined) {
                pinned.stars = freshStars;
            }
			const freshForks =
				forkMap.get(`tashifkhan/${pinned.slug}`.toLowerCase()) ??
				forkMap.get(pinned.slug.toLowerCase());
			if (freshForks !== undefined) {
				pinned.forks = freshForks;
			}
			if (!pinned.topics?.length) {
				pinned.topics =
					topicsMap.get(`tashifkhan/${pinned.slug}`.toLowerCase()) ??
					topicsMap.get(pinned.slug.toLowerCase()) ??
					[];
			}
			// Pinned endpoint never includes README; backfill from GitHub.
			if (!pinned.readme?.trim() && pinned.github_link) {
				const match = pinned.github_link.match(
					/github\.com\/([^/]+\/[^/]+)/i
				);
				if (match) {
					pinned.readme = await fetchGithubReadme(match[1]);
				}
			}
			repoProjects.push(pinned);
		}
	}

	// Final pass: any project still missing a README (stats skeleton rows,
	// stale cache holes, or pinned-only entries that skipped above).
	await inBatches(
		repoProjects.filter((p) => !p.readme?.trim()),
		6,
		async (project) => {
			const match = project.github_link?.match(
				/github\.com\/([^/]+\/[^/]+)/i
			);
			if (!match) return;
			const readme = await fetchGithubReadme(match[1]);
			if (readme) project.readme = readme;
		}
	);

	// Sort: pinned first, then by stars desc within pinned; preserve original order otherwise
	repoProjects.sort((a, b) => {
		const aPinned = a.pinned ? 1 : 0;
		const bPinned = b.pinned ? 1 : 0;
		if (aPinned !== bPinned) return bPinned - aPinned;
		// If both pinned or both not pinned, sort by stars descending
        const starsA = a.stars ?? 0;
        const starsB = b.stars ?? 0;
        if (starsA !== starsB) return starsB - starsA;

		return 0; 
	});

	return repoProjects.filter((p) => {
        // Always show pinned projects
        if (p.pinned) return true;
        
        // Show if it's one of the special mapped forks
        if (FORK_MAPPINGS[p.slug] || FORK_MAPPINGS[p.title.toLowerCase()]) return true;
        
        // Show if it is NOT a fork (source repo)
        return !p.isFork;
    });
}


export const allProjects: Project[] = await fetchAllProjects();

/** ISO timestamp when projects data was last fetched (build / server). */
export const projectsFetchedAt: string = new Date().toISOString();
