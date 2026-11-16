/**
 * Repository, release, and analytics-project shapes.
 */

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
	/** Featured: pinned on the GitHub profile or tagged `featured`. */
	pinned?: boolean;
	/** Position among the profile pins, as ordered on GitHub. */
	pinRank?: number;
	/** Archived on GitHub. */
	archived?: boolean;
	/** Tagged work-in-progress; the card shows a WIP badge. */
	wip?: boolean;
	stars?: number;
	forks?: number;
	/** Last push date (ISO), mirrored from GitHub when available. */
	updated_at?: string | null;
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
    /** Release availability when the stats response omits release details. */
    hasReleases?: boolean;
}

export interface Contributor {
    login: string;
    avatar_url: string;
    html_url: string;
    contributions: number;
}

export interface AnalyticsProject {
	slug: string;
	name: string;
}

export interface AnalyticsProjectsResponse {
	projects: AnalyticsProject[];
	total: number;
}
