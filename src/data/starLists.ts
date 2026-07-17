export interface StarList {
  name: string;
  url: string;
  repositories?: string[]; // owner/repo slugs
  description?: string;
  num_repos?: number;
}

async function fetchStarLists(): Promise<StarList[]> {
  const endpoint = "https://github-stats.tashif.codes/tashifkhan/star-lists?include_repos=true";
  try {
    const res = await fetch(endpoint);
    if (!res.ok) {
      console.error("Failed to fetch star lists:", res.status, res.statusText);
      return [];
    }
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((l: any) => ({
      name: l.name,
      url: l.url,
      repositories: l.repositories || [],
      description: l.description,
      num_repos: l.num_repos,
    }));
  } catch (err) {
    console.error("Error fetching star lists:", err);
    return [];
  }
}

export const starLists: StarList[] = await fetchStarLists();

/** ISO timestamp when star lists were last fetched (build / server). */
export const starListsFetchedAt: string = new Date().toISOString();
