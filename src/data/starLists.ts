import { createCachedFetch } from "../lib/fetchCached";
import type { StarList } from "@/types";

const { fetchJson } = createCachedFetch("github");


async function fetchStarLists(): Promise<StarList[]> {
  const endpoint = "https://github-stats.tashif.codes/tashifkhan/star-lists?include_repos=true";
  const data = await fetchJson<any[]>(endpoint, "stats-star-lists-tashifkhan");
  if (!Array.isArray(data)) return [];
  return data.map((l: any) => ({
    name: l.name,
    url: l.url,
    repositories: l.repositories || [],
    description: l.description,
    num_repos: l.num_repos,
  }));
}

export const starLists: StarList[] = await fetchStarLists();

/** ISO timestamp when star lists were last fetched (build / server). */
export const starListsFetchedAt: string = new Date().toISOString();
