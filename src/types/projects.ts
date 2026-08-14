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

export interface AnalyticsProject {
	slug: string;
	name: string;
}

export interface AnalyticsProjectsResponse {
	projects: AnalyticsProject[];
	total: number;
}
