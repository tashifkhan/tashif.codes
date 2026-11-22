import { formatTitle } from "../lib/formatTitle";
import { getProjectEntry } from "../lib/docs";
import { slugify } from "../lib/slugify";
import {
	createCachedFetch,
	readCache as readCacheNS,
	writeCache as writeCacheNS,
} from "../lib/fetchCached";
import type { Project, RepoRelease } from "@/types";
import downloadsData from "./downloads.json";
import { projectOverrides } from "./projectOverrides";
import { starLists } from "./starLists";
import { FEATURED_TOPIC, HIDE_TOPICS, WIP_TOPICS, hasTopic, starListSlugs } from "./projectGroups";

/**
 * Apply the rules in src/data/projectGroups.ts that decide which repos exist
 * on the site and in what order. Grouping into sections happens at render
 * time; this only filters, flags and sorts.
 *
 * - Drops repos with a hide topic (configs, dotfiles, the profile README).
 * - Drops rows the stats API still lists under a name the owner no longer has
 *   on GitHub, such as a renamed repo. Pinned and star-listed repos are kept.
 * - Keeps one row per slug, preferring the source repo over a fork.
 * - Marks `featured`-topic repos as pinned and flags work in progress.
 * - Sorts pins in profile order, other featured repos next, then everything
 *   else by stars and most recent push.
 */
function curate(projects: Project[], ownSlugs: Set<string> | null): Project[] {
	const listed = new Set([...starListSlugs(starLists).values()].flatMap((s) => [...s]));
	const bySlug = new Map<string, Project>();
	for (const p of projects) {
		if (hasTopic(p, HIDE_TOPICS)) continue;
		if (ownSlugs && !ownSlugs.has(p.slug) && !p.pinned && !listed.has(p.slug)) {
			console.warn(`projects: skipping "${p.title}", not in ${OWNER}'s GitHub repos (renamed or private?)`);
			continue;
		}
		const seen = bySlug.get(p.slug);
		if (seen && !(seen.isFork && !p.isFork)) continue;
		bySlug.set(p.slug, p);
	}
	const kept = [...bySlug.values()];
	for (const p of kept) {
		if (hasTopic(p, [FEATURED_TOPIC])) p.pinned = true;
		p.wip = hasTopic(p, WIP_TOPICS);
	}
	const rank = (p: Project) => (p.pinned ? (p.pinRank ?? 1000) : 2000);
	return kept.sort(
		(a, b) =>
			rank(a) - rank(b) ||
			(b.stars ?? 0) - (a.stars ?? 0) ||
			(b.updated_at ?? "").localeCompare(a.updated_at ?? "")
	);
}


/**
 * The upstream stats API goes down periodically (500s), which used to collapse the
 * site to whatever the /pinned endpoint returned. Every remote payload is now
 * mirrored to disk on success and replayed when the live call fails.
 *
 * The namespace stays "github" so cache entries written before this moved into
 * src/lib/fetchCached.ts are still found.
 */
const CACHE_NS = "github";
const OWNER = "tashifkhan";
const { fetchJson: fetchJsonCached } = createCachedFetch(CACHE_NS);

/**
 * README caching stays hand-rolled rather than going through `fetchJson`: it
 * has to distinguish a 404 (durable "no README", safe to cache as empty) from
 * a rate limit (must never be cached), which a generic helper cannot see.
 */
const readCache = <T>(key: string) => readCacheNS<T>(CACHE_NS, key);
const writeCache = (key: string, data: unknown) =>
	writeCacheNS(CACHE_NS, key, data);

/** Unauthenticated GitHub allows 60 req/hr; use a token when the env has one. */
const GH_TOKEN =
	process.env.GITHUB_TOKEN ||
	process.env.GH_TOKEN ||
	process.env.PUBLIC_GITHUB_TOKEN ||
	"";
const GH_HEADERS: Record<string, string> = GH_TOKEN
	? { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json" }
	: { Accept: "application/vnd.github+json" };

async function fetchPinnedProjects(first = 6): Promise<Project[]> {
	try {
        // Reverted to only fetching tashifkhan's pinned projects
		const data = await fetchJsonCached<any[]>(
			`https://github-stats.tashif.codes/tashifkhan/pinned?first=${first}`,
			"stats-pinned-tashifkhan"
		);
		if (!Array.isArray(data)) return [];
		return (data as any[]).map((p, i) => ({
			title: formatTitle(p.name),
			description: p.description || "No description available.",
			languages: p.primary_language ? [p.primary_language] : [],
			topics: Array.isArray(p.topics) ? p.topics : [],
			github_link: p.url,
			readme: "", // Not provided by pinned endpoint
			slug: slugify(p.name),
			pinned: true,
			pinRank: i,
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
	/** repo name (lowercase) / full_name → last push date (ISO), used for RSS ordering */
	updatedMap: Map<string, string>;
	/** "owner/name" (lowercase) of archived repos */
	archived: Set<string>;
	/**
	 * Slugs of every repo the owner has on GitHub, or null when the list may be
	 * incomplete (fetch failed, or 100+ repos on a single page).
	 */
	ownSlugs: Set<string> | null;
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

/**
 * The repo a fork was made from. The stats API leaves `original_repo` empty,
 * so read `parent` from GitHub. Cached to disk because the parent never
 * changes; skipped without a token to save the anonymous rate limit.
 */
async function fetchForkParent(name: string): Promise<Project["originalRepo"]> {
	const key = `gh-parent-${OWNER}__${name}`.toLowerCase();
	const toRepo = (p: any): Project["originalRepo"] =>
		p?.full_name
			? { name: p.name, full_name: p.full_name, owner: p.owner?.login ?? p.full_name.split("/")[0], url: p.html_url }
			: null;
	const cached = readCache<{ parent: any }>(key);
	if (cached) return toRepo(cached.parent);
	if (!GH_TOKEN) return null;
	const data = await fetchJsonCached<any>(`https://api.github.com/repos/${OWNER}/${name}`, `gh-repo-${OWNER}__${name}`.toLowerCase(), {
		headers: GH_HEADERS,
	});
	if (!data || typeof data !== "object" || !("fork" in data)) return null;
	writeCache(key, { parent: data.parent ?? null });
	return toRepo(data.parent);
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
	const updatedMap = new Map<string, string>();
	const archived = new Set<string>();
	let ownSlugs: Set<string> | null = null;

	await Promise.all(users.map(async (user) => {
		try {
			const repos = await fetchJsonCached<any[]>(
				`https://api.github.com/users/${user}/repos?per_page=100&type=owner`,
				`gh-repos-${user}`,
				{ headers: GH_HEADERS }
			);
			if (!Array.isArray(repos)) return;
			if (user === OWNER && repos.length < 100) {
				ownSlugs = new Set(repos.map((repo: any) => slugify(String(repo.name ?? ""))));
			}

			repos.forEach((repo: any) => {
				if (repo.archived && repo.name) {
					archived.add(`${user}/${repo.name}`.toLowerCase());
				}
				const forks = repo.forks_count ?? repo.forks;
				const topics: string[] = Array.isArray(repo.topics)
					? repo.topics.filter((t: unknown): t is string => typeof t === "string")
					: [];
				const updatedAt: string =
					repo.pushed_at ?? repo.updated_at ?? repo.created_at;

				if (typeof forks === "number") {
					if (repo.full_name) {
						forkMap.set(repo.full_name.toLowerCase(), forks);
					}
					if (repo.name) {
						forkMap.set(`${user}/${repo.name}`.toLowerCase(), forks);
						forkMap.set(repo.name.toLowerCase(), forks);
					}
				}

				if (typeof updatedAt === "string" && updatedAt) {
					if (repo.full_name) {
						updatedMap.set(repo.full_name.toLowerCase(), updatedAt);
					}
					if (repo.name) {
						updatedMap.set(`${user}/${repo.name}`.toLowerCase(), updatedAt);
						updatedMap.set(repo.name.toLowerCase(), updatedAt);
						updatedMap.set(slugify(repo.name).toLowerCase(), updatedAt);
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

	return { forkMap, topicsMap, languageMap, updatedMap, archived, ownSlugs };
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

/** The lite stats response omits releases. Check public feeds without API tokens. */
async function hasPublishedRelease(project: Project): Promise<boolean> {
	if (project.releases?.some((release) => !release.draft)) return true;
	const repo = project.github_link.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/?$/)?.[1];
	if (!repo) return false;
	const key = `release-availability-${repo}`;
	const cached = readCache<{ checkedAt: number; hasReleases: boolean }>(key);
	if (cached && Date.now() - cached.checkedAt < 24 * 60 * 60 * 1000) return cached.hasReleases;
	try {
		const response = await fetch(`https://github.com/${repo}/releases.atom`, {
			signal: AbortSignal.timeout(8000),
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const feed = await response.text();
		// Reject error pages instead of caching them as an empty release list.
		if (!feed.includes('<feed xmlns="http://www.w3.org/2005/Atom"')) throw new Error("Invalid release feed");
		const hasReleases = /<entry(?:\s|>)/.test(feed);
		writeCache(key, { checkedAt: Date.now(), hasReleases });
		return hasReleases;
	} catch {
		console.warn(`Release feed unavailable for ${repo}; using cached availability`);
		return cached?.hasReleases ?? false;
	}
}

/**
 * Published releases, newest first, with assets. Falls back to the disk cache
 * on failure and returns `null` when nothing is known, so a failed fetch is not
 * mistaken for "no releases".
 */
async function fetchGithubReleases(project: Project): Promise<RepoRelease[] | null> {
	const repo = project.github_link.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/?$/)?.[1];
	if (!repo) return null;
	const data = await fetchJsonCached<any[]>(
		`https://api.github.com/repos/${repo}/releases?per_page=100`,
		`releases-${repo}`,
		{ headers: GH_HEADERS },
	);
	if (!Array.isArray(data)) return null;
	return data
		.filter((r) => !r.draft)
		.map((r) => ({
			id: r.id,
			tag_name: r.tag_name,
			name: r.name ?? null,
			body: r.body ?? null,
			url: r.html_url,
			draft: false,
			prerelease: Boolean(r.prerelease),
			created_at: r.created_at ?? null,
			published_at: r.published_at ?? null,
			assets: (r.assets ?? []).map((a: any) => ({
				name: a.name,
				download_url: a.browser_download_url,
				size: a.size,
				download_count: a.download_count,
				content_type: a.content_type ?? null,
				updated_at: a.updated_at ?? null,
			})),
		}));
}

const STATS_API = "https://github-stats.tashif.codes";
// Stops a bad `next` loop. 50 pages of 10 is 500 releases.
const MAX_RELEASE_PAGES = 50;

/**
 * `/repos` embeds only each repo's first page of releases. Follow
 * `releases_page.next` until it runs out so project pages list every release.
 * A failed page keeps whatever arrived before it.
 */
async function fillReleasePages(repos: any[]): Promise<void> {
	const paged = repos.filter((repo) => repo?.releases_page?.has_more && repo.releases_page.next);
	await inBatches(paged, 4, async (repo) => {
		let next: string | null = repo.releases_page.next;
		for (let i = 0; next && i < MAX_RELEASE_PAGES; i++) {
			const page = await fetchJsonCached<any>(
				`${STATS_API}${next}`,
				`stats-releases-${next.replace(/[^A-Za-z0-9]+/g, "-")}`,
			);
			if (!Array.isArray(page?.releases)) break;
			repo.releases = [...(repo.releases ?? []), ...page.releases];
			next = page.releases_page?.next ?? null;
		}
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
	await fillReleasePages(repos);

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
	const [pinnedProjects, { forkMap, topicsMap, languageMap, updatedMap, archived, ownSlugs }] =
		await Promise.all([fetchPinnedProjects(), repoMetaPromise]);
	const pinnedNames = new Set(
		pinnedProjects.map((p) => p.title.toLowerCase().trim())
	);
	const pinRanks = new Map(pinnedProjects.map((p) => [p.slug, p.pinRank]));
	// The pinned endpoint still carries primary_language when /repos does not.
	pinnedProjects.forEach((p) => {
		if (p.languages.length && !languageMap.has(p.slug.toLowerCase())) {
			languageMap.set(p.slug.toLowerCase(), p.languages);
		}
	});

	// Parents for forks the stats API didn't resolve.
	const forkParents = new Map<string, Project["originalRepo"]>();
	await inBatches(
		repos.filter((r: any) => (r.is_fork ?? r.fork) && !r.original_repo && typeof r.title === "string"),
		6,
		async (r: any) => {
			const parent = await fetchForkParent(r.title);
			if (parent) forkParents.set(r.title.toLowerCase(), parent);
		}
	);

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
		// Topics drive grouping (src/data/projectGroups.ts), so merge the stats
		// API's copy with GitHub's: either one can lag behind a fresh edit.
		const fromApi: string[] = Array.isArray(project.topics) ? project.topics : [];
		const own = topicsMap.get(`${OWNER}/${titleKey}`.toLowerCase()) ?? [];
		const merged = [...new Set([...fromApi, ...own])];
		if (merged.length > 0) return merged;
		return (
			(parentRepo ? topicsMap.get(parentRepo.toLowerCase()) : undefined) ??
			topicsMap.get(titleKey.toLowerCase()) ??
			[]
		);
	};

	const repoProjects: Project[] = repos.map((project: any) => {
		const titleFormatted = formatTitle(project.title);
		const isPinned = pinnedNames.has(titleFormatted.toLowerCase());
        const projectSlug = slugify(project.title);
        
        const originalRepo = project.original_repo ?? forkParents.get(project.title.toLowerCase()) ?? null;
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

		const updatedAt =
			(parentRepo ? updatedMap.get(parentRepo.toLowerCase()) : undefined) ??
			updatedMap.get(`tashifkhan/${project.title}`.toLowerCase()) ??
			updatedMap.get(project.title.toLowerCase()) ??
			updatedMap.get(projectSlug.toLowerCase()) ??
			undefined;
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
			pinRank: isPinned ? pinRanks.get(projectSlug) : undefined,
			archived: archived.has(`${OWNER}/${project.title}`.toLowerCase()),
			stars,
			forks,
			updated_at: updatedAt,
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
			if (!pinned.updated_at) {
				pinned.updated_at =
					updatedMap.get(`tashifkhan/${pinned.slug}`.toLowerCase()) ??
					updatedMap.get(pinned.slug.toLowerCase()) ??
					null;
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

	const visibleProjects = curate(repoProjects, ownSlugs);
	await inBatches(visibleProjects, 4, async (project) => {
		project.hasReleases = await hasPublishedRelease(project);
		// The stats API returns every release, but a cold or timed-out response
		// can still ship `releases: []`. Fill those from GitHub, only for repos
		// whose feed lists something.
		if (project.hasReleases && !project.releases?.length) {
			const releases = await fetchGithubReleases(project);
			if (releases) {
				project.releases = releases;
				// releases.atom also lists bare tags, so a tag-only repo
				// (bulk-messaging-system) would otherwise count as released.
				project.hasReleases = releases.length > 0;
			}
		}
	});
	return visibleProjects;
}


/**
 * Some repos set their GitHub homepage to a tashif.codes page, e.g.
 * /projects/Patchwork (wrong case) or /download/PaisaSplit (no release to
 * download). Those turn into "Live" buttons that 404 on every page that shows
 * the card. Point them at the real page, or drop them when there isn't one.
 */
function fixInternalLiveLinks(projects: Project[]): Project[] {
	const slugs = new Set(projects.map((p) => p.slug));
	const downloads = new Map(
		downloadsData.projects.map((d: { title: string }) => [d.title.toLowerCase(), d.title]),
	);
	for (const project of projects) {
		const raw = project.live_website_url;
		if (!raw) continue;
		let url: URL;
		try {
			url = new URL(raw);
		} catch {
			continue;
		}
		if (url.hostname !== "tashif.codes" && url.hostname !== "www.tashif.codes") continue;

		const [section, name] = url.pathname.split("/").filter(Boolean);
		let path: string | undefined = url.pathname.replace(/\/+$/, "") || "/";
		if (section === "projects" && name) {
			const slug = slugify(decodeURIComponent(name));
			// A link back to the card's own project page adds nothing.
			path = slugs.has(slug) && slug !== project.slug ? `/projects/${slug}` : undefined;
		} else if (section === "download" && name) {
			const title = downloads.get(decodeURIComponent(name).toLowerCase());
			path = title ? `/download/${encodeURIComponent(title)}` : undefined;
		}
		project.live_website_url = path ? `https://tashif.codes${path}${url.search}` : undefined;
	}
	return projects;
}

export const allProjects: Project[] = fixInternalLiveLinks(
	(await fetchAllProjects()).map((project) => ({
		...project,
		...projectOverrides[project.slug],
	})),
);

/** ISO timestamp when projects data was last fetched (build / server). */
export const projectsFetchedAt: string = new Date().toISOString();
