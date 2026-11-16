/**
 * Search and filters for the grouped grid in ProjectGrid.astro. Listens for
 * the `project-search` event that ProjectFilters dispatches.
 *
 * A repo can appear in several sections. While a query or filter is active,
 * the sections hide and each repo's first card moves into one ranked results
 * grid (exact matches, then fuzzy, each in page order). Clearing the filter
 * moves every card back to the grid it came from.
 */

export interface ProjectSearchDetail {
	term?: string;
	showLiveOnly?: boolean;
	showReleasesOnly?: boolean;
	list?: string;
}

const CARD = "[data-project-item-card]";
const home = new WeakMap<HTMLElement, HTMLElement>();
let pageOrder = 0;

function fuzzyMatch(text: string, query: string): boolean {
	let qi = 0;
	for (let i = 0; i < text.length && qi < query.length; i++) {
		if (text[i] === query[qi]) qi++;
	}
	return qi === query.length;
}

function normalizeRepoName(value?: string | null): string {
	if (!value) return "";
	const cleaned = value
		.toLowerCase()
		.trim()
		.replace(/[?#].*$/, "")
		.replace(/\.git$/, "")
		.replace(/\/+$/, "");
	const parts = cleaned.split("/").filter(Boolean);
	return parts[parts.length - 1] || "";
}

function starListRepos(list?: string): Set<string> | null {
	if (!list || list === "all-projects") return null;
	const starLists = (window as any).__STAR_LISTS__ as
		| { name: string; repositories?: string[] }[]
		| undefined;
	const selected = starLists?.find((l) => l.name === list);
	return new Set((selected?.repositories || []).map((r) => normalizeRepoName(r)).filter(Boolean));
}

/** Remember each card's grid and page position the first time it's seen. */
function register(cards: HTMLElement[]): void {
	for (const card of cards) {
		if (home.has(card)) continue;
		if (card.parentElement) home.set(card, card.parentElement);
		card.dataset.order = String(pageOrder++);
	}
}

const byOrder = (a: HTMLElement, b: HTMLElement) => Number(a.dataset.order) - Number(b.dataset.order);

function sendHome(cards: HTMLElement[]): void {
	for (const card of [...cards].sort(byOrder)) {
		const grid = home.get(card);
		if (grid && card.parentElement !== grid) grid.appendChild(card);
	}
	// Restore page order inside each grid that received cards.
	new Set(cards.map((c) => home.get(c))).forEach((grid) => {
		if (!grid) return;
		const inGrid = Array.from(grid.querySelectorAll<HTMLElement>(`:scope > ${CARD}`)).sort(byOrder);
		inGrid.forEach((c) => grid.appendChild(c));
	});
}

export function applyProjectSearch(detail: ProjectSearchDetail): void {
	const cards = Array.from(document.querySelectorAll<HTMLElement>(CARD));
	if (!cards.length) return;
	register(cards);

	const query = (detail.term || "").trim().toLowerCase();
	const listRepos = starListRepos(detail.list);
	const filtering =
		Boolean(query) || Boolean(detail.showLiveOnly) || Boolean(detail.showReleasesOnly) || listRepos !== null;

	const results = document.querySelector<HTMLElement>("[data-project-results]");
	const resultsGrid = document.querySelector<HTMLElement>("[data-project-results-grid]");
	document.documentElement.toggleAttribute("data-projects-filtering", filtering && Boolean(results));

	if (!filtering || !results || !resultsGrid) {
		cards.forEach((c) => (c.style.display = ""));
		sendHome(cards);
		if (results) results.hidden = true;
		document.querySelectorAll<HTMLElement>("[data-project-empty]").forEach((m) => (m.hidden = true));
		return;
	}

	const exact: HTMLElement[] = [];
	const fuzzy: HTMLElement[] = [];
	const misses: HTMLElement[] = [];
	for (const card of cards) {
		if (card.dataset.repeat === "true") continue;
		const fields = [
			card.querySelector("[data-project-title]")?.textContent || "",
			card.querySelector("[data-project-description]")?.textContent || "",
			...Array.from(card.querySelectorAll("[data-project-language]")).map((n) => n.textContent || ""),
			...Array.from(card.querySelectorAll("[data-project-topic]")).flatMap((n) => [
				n.getAttribute("data-project-topic") || "",
				n.textContent || "",
			]),
		].map((f) => f.toLowerCase());

		const hasLiveLink = card.querySelector("[data-live-link]") !== null || card.dataset.hasLiveLink === "true";
		const hasReleases =
			card.querySelector("[data-has-releases='true']") !== null || card.dataset.hasReleases === "true";
		const inList =
			listRepos === null ||
			listRepos.has(normalizeRepoName(card.querySelector("[data-github-link]")?.getAttribute("data-url")));

		const isExact = !query || fields.some((f) => f.includes(query));
		const isFuzzy = !isExact && fields.some((f) => fuzzyMatch(f, query));
		const matches =
			(isExact || isFuzzy) &&
			(!detail.showLiveOnly || hasLiveLink) &&
			(!detail.showReleasesOnly || hasReleases) &&
			inList;

		card.style.display = matches ? "" : "none";
		if (!matches) misses.push(card);
		else (isExact ? exact : fuzzy).push(card);
	}

	sendHome(misses);
	const hits = [...exact.sort(byOrder), ...fuzzy.sort(byOrder)];
	const frag = document.createDocumentFragment();
	hits.forEach((c) => frag.appendChild(c));
	resultsGrid.replaceChildren(frag);

	results.hidden = false;
	const count = results.querySelector("[data-project-results-count]");
	if (count) count.textContent = String(hits.length);
	document.querySelectorAll<HTMLElement>("[data-project-empty]").forEach((m) => (m.hidden = hits.length > 0));
}

let initialised = false;

/** Safe to call from several page scripts; listeners attach once. */
export function initProjectSearch(): void {
	if (initialised) return;
	initialised = true;
	document.addEventListener("project-search", (e) => {
		applyProjectSearch((e as CustomEvent<ProjectSearchDetail>).detail ?? {});
	});
	document.addEventListener("click", (e) => {
		// Chips for collapsed sections open the section they point at.
		const jump = (e.target as Element | null)?.closest<HTMLAnchorElement>("[data-project-jump]");
		const target = jump && document.getElementById(jump.hash.slice(1));
		if (target instanceof HTMLDetailsElement) target.open = true;

		const button = (e.target as Element | null)?.closest<HTMLButtonElement>("[data-project-show-more]");
		const section = button?.closest<HTMLElement>("[data-project-section]");
		if (!button || !section) return;
		const expanded = section.toggleAttribute("data-expanded");
		button.textContent = expanded ? "Show less" : `Show ${button.dataset.projectShowMore} more`;
	});
}
