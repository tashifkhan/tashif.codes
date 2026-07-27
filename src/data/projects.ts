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

async function fetchPinnedProjects(first = 6): Promise<Project[]> {
	try {
        // Reverted to only fetching tashifkhan's pinned projects
		const res = await fetch(
			`https://github-stats.tashif.codes/tashifkhan/pinned?first=${first}`
		);
		if (!res.ok) {
			console.error("Failed to fetch pinned projects:", res.status, res.statusText);
			return [];
		}
		const data = await res.json();
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
}

async function fetchRepoMeta(users: string[]): Promise<RepoMeta> {
	const forkMap = new Map<string, number>();
	const topicsMap = new Map<string, string[]>();

	await Promise.all(users.map(async (user) => {
		try {
			const response = await fetch(
				`https://api.github.com/users/${user}/repos?per_page=100&type=owner`
			);
			if (!response.ok) {
				console.error(
					`Failed to fetch repo meta for ${user}:`,
					response.status,
					response.statusText
				);
				return;
			}

			const repos = await response.json();
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
		} catch (e) {
			console.error(`Error fetching repo meta for ${user}:`, e);
		}
	}));

	return { forkMap, topicsMap };
}

async function fetchAllProjects(): Promise<Project[]> {
	let repos: any[] = [];
	try {
		const response = await fetch(
			"https://github-stats.tashif.codes/tashifkhan/repos"
		);
		if (!response.ok) {
			console.error("Failed to fetch projects:", response.statusText);
		} else {
			repos = await response.json();
		}
	} catch (e) {
		console.error("Error fetching repos", e);
	}

	// Fetch stars from multiple users to support parent repo star counts
	const starMap = new Map<string, number>();
    // User requested "multiple stars api call" for these accounts
    const starSources = ['tashifkhan', 'codeblech', 'codelif'];
    // Fork counts + topics from GitHub (topics also come from Stats API when deployed)
    const repoMetaPromise = fetchRepoMeta(starSources);
    
	await Promise.all(starSources.map(async (user) => {
        try {
            const starsRes = await fetch(
                `https://github-stats.tashif.codes/${user}/stars`
            );
            if (starsRes.ok) {
                const starsData = await starsRes.json();
                if (starsData.repositories && Array.isArray(starsData.repositories)) {
                    starsData.repositories.forEach((repo: any) => {
                        // Map by name (lowercase for safety)
                        // This allows looking up 'jsjiit' and finding the star count from the 'codeblech' fetch
                        starMap.set(repo.name.toLowerCase(), repo.stars);
                    });
                }
            } else {
                console.error(
                    `Failed to fetch stars for ${user}:`,
                    starsRes.status,
                    starsRes.statusText
                );
            }
        } catch (e) {
            console.error(`Error fetching stars for ${user}:`, e);
        }
    }));

	// Fetch pinned in parallel / earlier
	const [pinnedProjects, { forkMap, topicsMap }] = await Promise.all([
		fetchPinnedProjects(),
		repoMetaPromise,
	]);
	const pinnedNames = new Set(
		pinnedProjects.map((p) => p.title.toLowerCase().trim())
	);

	// Map repos -> Project objects
    const FORK_MAPPINGS: Record<string, string> = {
        "jsjiit": "codeblech/jsjiit",
        "jportal": "codeblech/jportal",
        "pyjiit": "codelif/pyjiit",
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
			languages: project.languages || [],
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
			repoProjects.push(pinned);
		}
	}

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
