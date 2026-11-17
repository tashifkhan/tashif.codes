import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutGrid, List, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { trigger } from "@/lib/haptics";
import { matchesQuery, topicSlug } from "@/lib/blog-shared";

export interface BlogTag {
	name: string;
	count: number;
}

type Layout = "grid" | "list";

interface Props {
	/** Sorted most-used first. */
	tags: BlogTag[];
	/** id of the BlogList this bar filters. */
	listId: string;
}

const LAYOUT_KEY = "blog-layout";
/** Pages whose URL carries the search and topic. */
const URL_PATHS = new Set(["/blog", "/blog/archive"]);

const readStoredLayout = (): Layout => {
	try {
		return localStorage.getItem(LAYOUT_KEY) === "list" ? "list" : "grid";
	} catch {
		return "grid";
	}
};

/**
 * Search, topic and layout controls for a BlogList.
 *
 * The cards are server-rendered; this only shows and hides them. Query and
 * topic live in the URL (`/blog?q=cors&topic=web`) so a filtered view can be
 * shared and post pages can link to a topic.
 */
export default function BlogFilters({ tags, listId }: Props) {
	const [query, setQuery] = useState("");
	const [topic, setTopic] = useState<string | null>(null);
	const [layout, setLayout] = useState<Layout>("grid");
	const [result, setResult] = useState({ visible: 0, total: 0 });
	const [ready, setReady] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	// Initial state from the URL and the stored layout.
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		setQuery(params.get("q") ?? "");
		const wanted = params.get("topic");
		setTopic(wanted ? (tags.find((t) => topicSlug(t.name) === wanted)?.name ?? null) : null);
		setLayout(readStoredLayout());
		setReady(true);
	}, [tags]);

	const apply = useCallback(() => {
		const list = document.getElementById(listId);
		if (!list) return;

		list.querySelectorAll<HTMLElement>("[data-blog-view]").forEach((view) => {
			view.hidden = view.dataset.blogView !== layout;
		});

		const matches = (card: HTMLElement) => {
			const cardTags = (card.dataset.blogTags ?? "").split(",").filter(Boolean);
			if (topic && !cardTags.includes(topic)) return false;
			return matchesQuery(
				[
					card.querySelector("[data-blog-title]")?.textContent ?? "",
					card.querySelector("[data-blog-excerpt]")?.textContent ?? "",
					...cardTags,
				],
				query,
			);
		};

		let visible = 0;
		let total = 0;
		list.querySelectorAll<HTMLElement>("[data-blog-card]").forEach((card) => {
			const show = matches(card);
			card.hidden = !show;
			// Count each post once, from the grid view.
			if (card.closest('[data-blog-view="grid"]')) {
				total++;
				if (show) visible++;
			}
		});

		list.querySelectorAll<HTMLElement>("[data-blog-year-group]").forEach((group) => {
			const shown = group.querySelectorAll("[data-blog-card]:not([hidden])").length;
			group.hidden = shown === 0;
			const count = group.querySelector("[data-blog-year-count]");
			if (count) count.textContent = `${shown} post${shown === 1 ? "" : "s"}`;
		});

		setResult({ visible, total });
	}, [listId, layout, query, topic]);

	useEffect(() => {
		if (ready) apply();
	}, [ready, apply]);

	// Live refresh rewrites titles, excerpts and tags in place.
	useEffect(() => {
		document.addEventListener("blog-data-refreshed", apply);
		return () => document.removeEventListener("blog-data-refreshed", apply);
	}, [apply]);

	// Mirror query and topic into the address bar without adding history.
	useEffect(() => {
		if (!ready) return;
		const path = window.location.pathname.replace(/\/+$/, "") || "/";
		if (!URL_PATHS.has(path)) return;
		const params = new URLSearchParams(window.location.search);
		const q = query.trim();
		if (q) params.set("q", q);
		else params.delete("q");
		if (topic) params.set("topic", topicSlug(topic));
		else params.delete("topic");
		const qs = params.toString();
		const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
		if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
			history.replaceState(history.state, "", next);
		}
	}, [ready, query, topic]);

	const chooseTopic = (name: string | null) => {
		trigger("selection");
		setTopic((current) => (current === name ? null : name));
	};

	const chooseLayout = (next: Layout) => {
		if (next === layout) return;
		trigger("selection");
		setLayout(next);
		try {
			localStorage.setItem(LAYOUT_KEY, next);
		} catch {
			// layout just won't be remembered
		}
	};

	const clearAll = () => {
		trigger("selection");
		setQuery("");
		setTopic(null);
	};

	const filtering = query.trim() !== "" || topic !== null;

	const chipClass = (active: boolean) =>
		cn(
			"motion-control inline-flex shrink-0 items-center gap-1.5 h-8 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap snap-start",
			"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
			active
				? "border-primary bg-primary text-primary-foreground"
				: "border-border/60 bg-card/50 text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground",
		);

	const layoutButton = (value: Layout, label: string, Icon: typeof List) => (
		<button
			type="button"
			aria-pressed={layout === value}
			onClick={() => chooseLayout(value)}
			className={cn(
				"inline-flex h-10 items-center gap-1.5 px-3 text-[13px] font-medium",
				layout === value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
			)}
		>
			<Icon className="h-4 w-4" aria-hidden="true" />
			{label}
		</button>
	);

	return (
		<div className="mb-6 sm:mb-8 space-y-3">
			<div className="flex flex-wrap items-center gap-2.5">
				<div className="relative min-w-[14rem] flex-1 sm:max-w-xl">
					<Search
						className="pointer-events-none absolute left-3 z-10 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
						aria-hidden="true"
					/>
					<Input
						ref={inputRef}
						type="search"
						placeholder="Search titles, topics and excerpts"
						aria-label="Search posts"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Escape" && query) setQuery("");
						}}
						className="h-10 pl-9 pr-9 bg-background/50 backdrop-blur-sm [&::-webkit-search-cancel-button]:hidden"
					/>
					{query && (
						<button
							type="button"
							onClick={() => {
								setQuery("");
								inputRef.current?.focus();
							}}
							className="absolute right-1.5 z-10 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
							aria-label="Clear search"
						>
							<X className="h-4 w-4" />
						</button>
					)}
				</div>
				<div
					role="group"
					aria-label="Layout"
					className="inline-flex overflow-hidden rounded-lg border border-border/60 bg-card/50 divide-x divide-border/60"
				>
					{layoutButton("grid", "Grid", LayoutGrid)}
					{layoutButton("list", "List", List)}
				</div>
			</div>

			{/* One swipeable row on phones, wrapping rows from sm up. */}
			<div
				role="group"
				aria-label="Filter posts by topic"
				className={cn(
					"no-scrollbar -mx-4 max-w-none! flex gap-2 overflow-x-auto px-4 pb-1 snap-x scroll-px-4",
					"[mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]",
					"sm:mx-0 sm:max-w-full! sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 sm:scroll-px-0 sm:[mask-image:none]",
				)}
			>
				<button
					type="button"
					aria-pressed={topic === null}
					onClick={() => topic !== null && chooseTopic(null)}
					className={chipClass(topic === null)}
				>
					All
				</button>
				{tags.map((tag) => {
					const active = topic === tag.name;
					return (
						<button
							key={tag.name}
							type="button"
							aria-pressed={active}
							onClick={() => chooseTopic(tag.name)}
							className={chipClass(active)}
						>
							{tag.name}
							<span
								className={cn(
									"font-mono text-[11px] tabular-nums",
									active ? "text-primary-foreground/75" : "text-muted-foreground/70",
								)}
							>
								{tag.count}
							</span>
						</button>
					);
				})}
			</div>

			<div className="min-h-5 text-xs text-muted-foreground" aria-live="polite">
				{filtering && (
					<span className="inline-flex items-center gap-2">
						<span>
							<span className="font-semibold text-foreground tabular-nums">{result.visible}</span> of{" "}
							{result.total} posts{topic && ` in ${topic}`}
						</span>
						<span aria-hidden="true" className="text-border">
							·
						</span>
						<button type="button" onClick={clearAll} className="font-semibold text-primary hover:underline">
							Clear
						</button>
					</span>
				)}
			</div>

			{filtering && result.visible === 0 && (
				<div className="rounded-xl border border-dashed border-border/60 px-4 py-10 text-center">
					<p className="text-sm font-medium text-foreground">
						No posts match{query.trim() ? ` "${query.trim()}"` : ""}
						{topic ? ` in ${topic}` : ""}
					</p>
					<p className="mt-1 text-xs text-muted-foreground">Try a shorter word or another topic.</p>
				</div>
			)}
		</div>
	);
}
