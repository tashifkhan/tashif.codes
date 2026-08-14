/**
 * Client-side re-fetch of build-time data sources, then patch live DOM.
 * Used by the shared DataFreshness chip so SSG pages can still refresh.
 *
 * All third-party calls go through same-origin `/proxy/*` rewrites
 * (vercel.json in prod, vite server.proxy in `astro dev`) to avoid CORS.
 */

import { githubAttributedStatsUrl, githubUsernames, personalGithubUsername } from "@/data/profile";
import { formatTitle } from "@/lib/formatTitle";
import { slugify } from "@/lib/slugify";
import { dispatchLiveRefreshed, writeStoredFetchedAt } from "@/lib/dataFreshness";
import type { LiveDataSource } from "@/types";

/** Pure sort — kept local so we don't pull `blog.ts` top-level fetches into the client bundle. */
function sortBlogPostsNewestFirst<T extends { date: string; slug: string }>(
	posts: T[],
): T[] {
	return [...posts].sort((a, b) => {
		const byDate = new Date(b.date).getTime() - new Date(a.date).getTime();
		if (byDate !== 0) return byDate;
		return a.slug.localeCompare(b.slug);
	});
}

/** Same-origin proxies — never hit third-party hosts from the browser. */
const GH_STATS = "/proxy/gh-stats";
const LC_STATS = "/proxy/lc-stats/khan-tashif";
const BLOG_API = "/proxy/blog";
const GHPVC = "/proxy/ghpvc";

type MetricPair = { all: string; personal: string };

function nowIso(): string {
	return new Date().toISOString();
}

/** Human-readable error for fetch failures (CORS / offline / blocked). */
export function friendlyFetchError(err: unknown, fallback: string): string {
	const msg = err instanceof Error ? err.message : String(err ?? "");
	if (
		/networkerror|failed to fetch|load failed|network request failed/i.test(msg)
	) {
		return "Couldn't reach the stats service. Check your connection and try again.";
	}
	if (/abort/i.test(msg)) return "Request was cancelled.";
	return msg.trim() || fallback;
}

async function fetchJson<T>(url: string): Promise<T | null> {
	try {
		const res = await fetch(url, { cache: "no-store" });
		if (!res.ok) {
			console.error(`liveRefresh: ${url} → ${res.status}`);
			return null;
		}
		return (await res.json()) as T;
	} catch (err) {
		console.error(`liveRefresh: ${url} failed`, err);
		return null;
	}
}

async function fetchJsonRequired<T>(url: string, label: string): Promise<T> {
	try {
		const res = await fetch(url, { cache: "no-store" });
		if (!res.ok) {
			throw new Error(`${label} returned ${res.status}`);
		}
		return (await res.json()) as T;
	} catch (err) {
		throw new Error(friendlyFetchError(err, `Couldn't refresh ${label}`));
	}
}

// ── GitHub ──────────────────────────────────────────────────────────────────

type GhStatsPayload = {
	totalCommits?: number;
	longestStreak?: number;
	currentStreak?: number;
	topLanguages?: { name: string; percentage: number; color?: string }[];
};

type GhStarsPayload = {
	total_stars?: number;
	repositories?: { name: string; stars: number; url?: string }[];
};

async function fetchExtraParentStars(): Promise<number> {
	const mappings = [
		{ user: "codeblech", repos: ["jsjiit", "jportal"] },
		{ user: "codelif", repos: ["pyjiit"] },
	];
	let total = 0;
	await Promise.all(
		mappings.map(async ({ user, repos }) => {
			const data = await fetchJson<GhStarsPayload>(`${GH_STATS}/${user}/stars`);
			for (const repo of data?.repositories ?? []) {
				if (repos.includes(repo.name.toLowerCase())) {
					total += repo.stars ?? 0;
				}
			}
		}),
	);
	return total;
}

async function fetchViews(usernames: string[]): Promise<number> {
	let total = 0;
	for (const username of usernames) {
		try {
			const params = new URLSearchParams({
				username,
				style: "for-the-badge",
				color: "orange",
			});
			const res = await fetch(`${GHPVC}?${params.toString()}`, {
				cache: "no-store",
			});
			if (!res.ok) continue;
			const text = await res.text();
			const titleMatch = text.match(/<title>(.*?)<\/title>/);
			const matches = titleMatch?.[1]?.match(/(\d[\d,]*)/);
			if (matches?.[0]) {
				total += parseInt(matches[0].replace(/,/g, ""), 10);
			}
		} catch {
			// Views are optional — never fail the whole refresh
		}
	}
	return total;
}

async function loadUserBundle(username: string) {
	const [stats, prs, stars, commits, pulls] = await Promise.all([
		fetchJson<GhStatsPayload>(githubAttributedStatsUrl(GH_STATS, username)),
		fetchJson<unknown[]>(`${GH_STATS}/${username}/prs`),
		fetchJson<GhStarsPayload>(`${GH_STATS}/${username}/stars`),
		fetchJson<
			{
				sha?: string;
				message?: string;
				url?: string;
				repo?: string;
				timestamp?: string;
			}[]
		>(`${GH_STATS}/${username}/commits`),
		fetchJson<unknown[]>(`${GH_STATS}/${username}/me/pulls`),
	]);
	return {
		username,
		stats,
		prs: prs ?? [],
		stars,
		commits: commits ?? [],
		pulls: pulls ?? [],
	};
}

function aggregateMetrics(
	bundles: Awaited<ReturnType<typeof loadUserBundle>>[],
	extraStars: number,
	views: number,
): {
	commits: number;
	streak: number;
	longest: number;
	stars: number;
	prs: number;
	views: number;
	languages: { name: string; percentage: number; color?: string }[];
	commitsList: { message: string; url: string; repo?: string }[];
	prsList: { title: string; url: string; state: string; repo?: string }[];
} {
	let commits = 0;
	let streak = 0;
	let longest = 0;
	let stars = extraStars;
	const prUrls = new Set<string>();
	const languages: { name: string; percentage: number; color?: string }[] = [];
	const commitsList: { message: string; url: string; repo?: string }[] = [];
	const prsList: { title: string; url: string; state: string; repo?: string }[] =
		[];

	for (const b of bundles) {
		if (b.stats) {
			commits += b.stats.totalCommits ?? 0;
			streak = Math.max(streak, b.stats.currentStreak ?? 0);
			longest = Math.max(longest, b.stats.longestStreak ?? 0);
			if (languages.length === 0 && b.stats.topLanguages?.length) {
				languages.push(...b.stats.topLanguages);
			}
		}
		stars += b.stars?.total_stars ?? 0;
		for (const pr of b.prs as {
			url?: string;
			title?: string;
			state?: string;
			repo?: string;
		}[]) {
			if (pr.url && !prUrls.has(pr.url)) {
				prUrls.add(pr.url);
				prsList.push({
					title: pr.title ?? "Pull request",
					url: pr.url,
					state: pr.state ?? "open",
					repo: pr.repo,
				});
			}
		}
		for (const c of b.commits) {
			if (c.url && c.message) {
				commitsList.push({
					message: c.message,
					url: c.url,
					repo: c.repo,
				});
			}
		}
	}

	return {
		commits,
		streak,
		longest,
		stars,
		prs: prUrls.size,
		views,
		languages: languages.slice(0, 6),
		commitsList: commitsList.slice(0, 5),
		prsList: prsList.slice(0, 5),
	};
}

function applyPersonalOnlyDisplay() {
	const personalOnly = localStorage.getItem("github_personal_only") === "1";
	document.dispatchEvent(
		new CustomEvent("github-personal-only-change", {
			detail: { personalOnly },
		}),
	);
}

function applyGitHubMetrics(
	all: ReturnType<typeof aggregateMetrics>,
	personal: ReturnType<typeof aggregateMetrics>,
) {
	const pairs: Record<string, MetricPair> = {
		commits: {
			all: all.commits.toLocaleString(),
			personal: personal.commits.toLocaleString(),
		},
		streak: {
			all: String(all.streak),
			personal: String(personal.streak),
		},
		longest: {
			all: String(all.longest),
			personal: String(personal.longest),
		},
		stars: {
			all: all.stars.toLocaleString(),
			personal: personal.stars.toLocaleString(),
		},
		prs: {
			all: String(all.prs),
			personal: String(personal.prs),
		},
		views: {
			all: all.views.toLocaleString(),
			personal: personal.views.toLocaleString(),
		},
	};

	const keys = Object.keys(pairs);
	const nodes = document.querySelectorAll("[data-github-metric]");
	nodes.forEach((el, i) => {
		const node = el as HTMLElement;
		const key = node.dataset.metric || keys[i];
		const pair = key ? pairs[key] : undefined;
		if (!pair) return;
		node.dataset.valueAll = pair.all;
		node.dataset.valuePersonal = pair.personal;
		if (key) node.dataset.metric = key;
	});

	const heading = document.querySelector(
		"[data-github-heading-commits]",
	) as HTMLElement | null;
	if (heading) {
		heading.dataset.valueAll = pairs.commits.all;
		heading.dataset.valuePersonal = pairs.commits.personal;
	}

	document.querySelectorAll("[data-live-github-commits]").forEach((el) => {
		const node = el as HTMLElement;
		node.dataset.valueAll = pairs.commits.all;
		node.dataset.valuePersonal = pairs.commits.personal;
		const personalOnly = localStorage.getItem("github_personal_only") === "1";
		node.textContent = personalOnly
			? pairs.commits.personal
			: pairs.commits.all;
	});

	applyPersonalOnlyDisplay();
	document.dispatchEvent(new CustomEvent("github-stats-refreshed"));
}

export async function refreshGitHub(): Promise<string> {
	try {
		const [extraStars, viewsAll, viewsPersonal, ...bundles] = await Promise.all([
			fetchExtraParentStars(),
			fetchViews([...githubUsernames]),
			fetchViews([personalGithubUsername]),
			...githubUsernames.map((u) => loadUserBundle(u)),
		]);

		// At least one account must return stats
		const anyStats = bundles.some((b) => b.stats != null);
		if (!anyStats) {
			throw new Error(
				"Couldn't load GitHub stats. The stats service may be temporarily unavailable.",
			);
		}

		const personalBundles = bundles.filter(
			(b) => b.username === personalGithubUsername,
		);
		const personalFirst = [
			...personalBundles,
			...bundles.filter((b) => b.username !== personalGithubUsername),
		];

		const all = aggregateMetrics(personalFirst, extraStars, viewsAll);
		const personal = aggregateMetrics(
			personalBundles,
			extraStars,
			viewsPersonal,
		);

		applyGitHubMetrics(all, personal);

		const fetchedAt = nowIso();
		writeStoredFetchedAt("github", fetchedAt);
		dispatchLiveRefreshed("github", fetchedAt);
		return fetchedAt;
	} catch (err) {
		throw new Error(friendlyFetchError(err, "Couldn't refresh GitHub stats"));
	}
}

// ── LeetCode ────────────────────────────────────────────────────────────────

type LcStats = {
	totalSolved?: number;
	totalQuestions?: number;
	easySolved?: number;
	totalEasy?: number;
	mediumSolved?: number;
	totalMedium?: number;
	hardSolved?: number;
	totalHard?: number;
	ranking?: number;
	contributionPoints?: number;
	reputation?: number;
};

function setText(sel: string, value: string) {
	document.querySelectorAll(sel).forEach((el) => {
		el.textContent = value;
	});
}

function applyLeetCode(stats: LcStats) {
	const totalSolved = stats.totalSolved ?? 0;
	const totalQuestions = stats.totalQuestions ?? 0;
	const ranking = stats.ranking ?? 0;
	const reputation = stats.reputation ?? 0;
	const contribution = stats.contributionPoints ?? 0;

	setText("[data-lc-metric='totalSolved']", totalSolved.toString());
	setText("[data-lc-metric='totalQuestions']", `of ${totalQuestions} problems`);
	setText(
		"[data-lc-metric='ranking']",
		ranking > 0 ? `#${ranking.toLocaleString()}` : "#—",
	);
	setText("[data-lc-metric='reputation']", reputation.toString());
	setText("[data-lc-metric='contribution']", contribution.toString());
	setText("[data-lc-heading-solved]", totalSolved.toString());

	const diffs: { key: string; solved: number; total: number }[] = [
		{ key: "easy", solved: stats.easySolved ?? 0, total: stats.totalEasy ?? 0 },
		{
			key: "medium",
			solved: stats.mediumSolved ?? 0,
			total: stats.totalMedium ?? 0,
		},
		{ key: "hard", solved: stats.hardSolved ?? 0, total: stats.totalHard ?? 0 },
	];

	for (const d of diffs) {
		const pct = d.total > 0 ? Math.round((d.solved / d.total) * 100) : 0;
		setText(`[data-lc-diff='${d.key}'] [data-lc-diff-solved]`, String(d.solved));
		setText(`[data-lc-diff='${d.key}'] [data-lc-diff-total]`, `/${d.total}`);
		setText(`[data-lc-diff='${d.key}'] [data-lc-diff-pct]`, `${pct}% solved`);
		document
			.querySelectorAll(`[data-lc-diff='${d.key}'] [data-lc-diff-bar]`)
			.forEach((bar) => {
				(bar as HTMLElement).style.width = `${pct}%`;
			});
	}
}

export async function refreshLeetCode(): Promise<string> {
	const stats = await fetchJsonRequired<LcStats>(LC_STATS, "LeetCode stats");
	// Warm secondary endpoints (best-effort)
	await Promise.all([
		fetchJson(`${LC_STATS}/contests`),
		fetchJson(`${LC_STATS}/badges`),
		fetchJson(`${LC_STATS}/profile`),
	]);

	applyLeetCode(stats);

	const fetchedAt = nowIso();
	writeStoredFetchedAt("leetcode", fetchedAt);
	dispatchLiveRefreshed("leetcode", fetchedAt);
	return fetchedAt;
}

// ── Projects ────────────────────────────────────────────────────────────────

type RepoPayload = {
	title: string;
	stars?: number;
	stargazers?: number;
	stargazers_count?: number;
	forks?: number;
	forks_count?: number;
	is_fork?: boolean;
	fork?: boolean;
};

export async function refreshProjects(): Promise<string> {
	const starSources = ["tashifkhan", "codeblech", "codelif"];
	const starMap = new Map<string, number>();

	await Promise.all(
		starSources.map(async (user) => {
			const data = await fetchJson<GhStarsPayload>(`${GH_STATS}/${user}/stars`);
			for (const repo of data?.repositories ?? []) {
				starMap.set(repo.name.toLowerCase(), repo.stars);
			}
		}),
	);

	const repos =
		(await fetchJsonRequired<RepoPayload[]>(
			`${GH_STATS}/tashifkhan/repos`,
			"projects",
		)) ?? [];

	const bySlug = new Map<string, { stars: number; forks: number }>();
	for (const project of repos) {
		const slug = slugify(project.title);
		const titleKey = project.title.toLowerCase();
		const stars =
			starMap.get(titleKey) ??
			project.stars ??
			project.stargazers ??
			project.stargazers_count ??
			0;
		const forks = project.forks ?? project.forks_count ?? 0;
		bySlug.set(slug, { stars, forks });
		bySlug.set(slugify(formatTitle(project.title)), { stars, forks });
	}

	document.querySelectorAll("[data-project-card]").forEach((card) => {
		const el = card as HTMLElement;
		const slug =
			el.dataset.projectSlug ||
			el
				.querySelector("[data-project-title] a")
				?.getAttribute("href")
				?.split("/")
				.pop() ||
			"";
		if (!slug) return;
		const fresh = bySlug.get(slug) ?? bySlug.get(slug.toLowerCase());
		if (!fresh) return;

		const starsEl = el.querySelector("[data-project-stars]");
		if (starsEl) {
			starsEl.textContent = String(fresh.stars);
			const wrap = starsEl.closest(
				"[data-project-stars-wrap]",
			) as HTMLElement | null;
			if (wrap) wrap.hidden = fresh.stars <= 0;
		}
		const forksEl = el.querySelector("[data-project-forks]");
		if (forksEl) {
			forksEl.textContent = String(fresh.forks);
			const wrap = forksEl.closest(
				"[data-project-forks-wrap]",
			) as HTMLElement | null;
			if (wrap) wrap.hidden = fresh.forks <= 0;
		}
	});

	const lists = await fetchJson<
		{
			name: string;
			url: string;
			repositories?: string[];
			description?: string;
			num_repos?: number;
		}[]
	>(`${GH_STATS}/tashifkhan/star-lists?include_repos=true`);
	if (Array.isArray(lists)) {
		// @ts-expect-error global bridge used by ProjectFilters
		window.__STAR_LISTS__ = lists.map((l) => ({
			name: l.name,
			url: l.url,
			repositories: l.repositories || [],
			description: l.description,
			num_repos: l.num_repos,
		}));
		document.dispatchEvent(new CustomEvent("star-lists-refreshed"));
	}

	const fetchedAt = nowIso();
	writeStoredFetchedAt("projects", fetchedAt);
	dispatchLiveRefreshed("projects", fetchedAt);
	return fetchedAt;
}

// ── Blog ────────────────────────────────────────────────────────────────────

type BlogListPost = {
	slug: string;
	title: string;
	date: string;
	tags?: string[];
	excerpt?: string;
	coverImage?: string;
	wordCount?: number;
	readingTimeMinutes?: number;
	metadata?: Record<string, unknown>;
};

const BLOG_SITE_ORIGIN = "https://blog.tashif.codes";

function resolveBlogCoverUrl(
	post: Pick<BlogListPost, "coverImage" | "metadata">,
): string | undefined {
	const raw =
		(typeof post.coverImage === "string" && post.coverImage) ||
		(typeof post.metadata?.coverImage === "string"
			? (post.metadata.coverImage as string)
			: undefined);
	if (!raw) return undefined;
	if (/^https?:\/\//i.test(raw)) return raw;
	return `${BLOG_SITE_ORIGIN}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

function formatBlogDate(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function resolveListReadingMinutes(post: BlogListPost): number {
	const fromApi =
		typeof post.readingTimeMinutes === "number" && post.readingTimeMinutes > 0
			? post.readingTimeMinutes
			: undefined;
	if (fromApi != null) return fromApi;
	const fromMeta =
		typeof post.metadata?.readingTimeMinutes === "number" &&
		(post.metadata.readingTimeMinutes as number) > 0
			? (post.metadata.readingTimeMinutes as number)
			: undefined;
	if (fromMeta != null) return fromMeta;
	const words =
		(typeof post.wordCount === "number" && post.wordCount > 0
			? post.wordCount
			: 0) ||
		(typeof post.metadata?.wordCount === "number"
			? (post.metadata.wordCount as number)
			: 0);
	if (words > 0) return Math.max(1, Math.round(words / 200));
	return 1;
}

/** Update list UI meta only — no views/likes/comments (those belong on post pages). */
function applyBlogListMeta(list: BlogListPost[]) {
	let readingSum = 0;
	let readingCount = 0;

	for (const post of list) {
		const readMins = resolveListReadingMinutes(post);
		if (readMins > 0) {
			readingSum += readMins;
			readingCount += 1;
		}

		document
			.querySelectorAll<HTMLElement>(`[data-blog-slug="${post.slug}"]`)
			.forEach((root) => {
				const titleEl = root.querySelector("[data-blog-title]");
				if (titleEl && post.title) titleEl.textContent = post.title;

				const excerptEl = root.querySelector("[data-blog-excerpt]");
				if (excerptEl && post.excerpt != null) {
					excerptEl.textContent = post.excerpt;
				}

				const dateEl = root.querySelector("[data-blog-date]");
				if (dateEl && post.date) {
					dateEl.textContent = formatBlogDate(post.date);
				}

				const coverUrl = resolveBlogCoverUrl(post);
				const coverWrap = root.querySelector<HTMLElement>(
					"[data-blog-cover-wrap]",
				);
				const coverImgs = root.querySelectorAll<HTMLImageElement>(
					"[data-blog-cover]",
				);
				coverImgs.forEach((img) => {
					if (coverUrl) {
						img.src = coverUrl;
						img.classList.remove("hidden");
					} else {
						img.removeAttribute("src");
						img.classList.add("hidden");
					}
				});
				if (coverWrap) {
					if (coverUrl) coverWrap.classList.remove("hidden");
					else coverWrap.classList.add("hidden");
				}

				root
					.querySelectorAll<HTMLElement>("[data-reading-time] span")
					.forEach((el) => {
						el.textContent = String(readMins);
					});

				const tags = Array.isArray(post.tags) ? post.tags : [];
				root.setAttribute("data-blog-tags", tags.join(","));
			});
	}

	document.querySelectorAll("[data-blog-post-count]").forEach((el) => {
		el.textContent = String(list.length);
	});

	if (readingCount > 0) {
		const avg = Math.round(readingSum / readingCount);
		document.querySelectorAll("[data-blog-avg-read]").forEach((el) => {
			el.textContent = String(avg);
		});
	}

	document.dispatchEvent(
		new CustomEvent("blog-data-refreshed", {
			detail: { posts: list.length },
		}),
	);
}

export async function refreshBlog(): Promise<string> {
	const list = await fetchJsonRequired<BlogListPost[]>(
		`${BLOG_API}/posts.json`,
		"blog posts",
	);

	if (!Array.isArray(list)) {
		throw new Error("Could not refresh blog posts");
	}

	const sorted = sortBlogPostsNewestFirst(list);
	applyBlogListMeta(sorted);

	const fetchedAt = nowIso();
	writeStoredFetchedAt("blog", fetchedAt);
	dispatchLiveRefreshed("blog", fetchedAt);
	return fetchedAt;
}

// ── Dispatcher ──────────────────────────────────────────────────────────────

export async function refreshLiveSource(
	source: Exclude<LiveDataSource, "project-stats">,
): Promise<string> {
	switch (source) {
		case "github":
			return refreshGitHub();
		case "leetcode":
			return refreshLeetCode();
		case "projects":
			return refreshProjects();
		case "blog":
			return refreshBlog();
		default:
			throw new Error(`Unknown live source: ${source}`);
	}
}
