import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { trigger } from "@/lib/haptics";

export interface BlogTag {
	name: string;
	count: number;
}

interface Props {
	/** Sorted most-used first; the collapsed desktop row shows the head of this list. */
	tags: BlogTag[];
}

/** Tags shown on desktop before "more". Mobile scrolls one row instead. */
const COLLAPSED_TAG_COUNT = 10;

export default function BlogFilters({ tags }: Props) {
	const [searchTerm, setSearchTerm] = useState("");
	const [selected, setSelected] = useState<string[]>([]);
	const [expanded, setExpanded] = useState(false);
	const [result, setResult] = useState<{ visible: number; total: number } | null>(
		null,
	);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const onResult = (e: Event) =>
			setResult((e as CustomEvent<{ visible: number; total: number }>).detail);
		document.addEventListener("blog-filter-result", onResult);
		return () => document.removeEventListener("blog-filter-result", onResult);
	}, []);

	const emitSearch = (term: string) => {
		setSearchTerm(term);
		document.dispatchEvent(
			new CustomEvent("blog-search", { detail: { term } }),
		);
	};

	const emitTags = (next: string[]) => {
		setSelected(next);
		document.dispatchEvent(
			new CustomEvent("blog-category", {
				detail: { categories: next.length ? next : ["all"] },
			}),
		);
	};

	const toggleTag = (name: string) => {
		trigger("selection");
		emitTags(
			selected.includes(name)
				? selected.filter((t) => t !== name)
				: [...selected, name],
		);
	};

	const clearAll = () => {
		trigger("selection");
		emitSearch("");
		emitTags([]);
	};

	const filtering = searchTerm.trim() !== "" || selected.length > 0;
	const hiddenCount = Math.max(0, tags.length - COLLAPSED_TAG_COUNT);

	const chipClass = (active: boolean) =>
		cn(
			"motion-control inline-flex shrink-0 items-center gap-1.5 h-8 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap",
			"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
			active
				? "border-primary bg-primary text-primary-foreground"
				: "border-border/60 bg-card/50 text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground",
		);

	return (
		<div className="mb-6 sm:mb-8 space-y-3">
			<div className="relative sm:max-w-xl">
				<Search
					className="pointer-events-none absolute left-3 z-10 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
					aria-hidden="true"
				/>
				<Input
					ref={inputRef}
					type="search"
					placeholder="Search posts..."
					aria-label="Search posts by title or tag"
					value={searchTerm}
					onChange={(e) => emitSearch(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Escape" && searchTerm) emitSearch("");
					}}
					className="h-10 pl-9 pr-9 bg-background/50 backdrop-blur-sm [&::-webkit-search-cancel-button]:hidden"
				/>
				{searchTerm && (
					<button
						type="button"
						onClick={() => {
							emitSearch("");
							inputRef.current?.focus();
						}}
						className="absolute right-1.5 z-10 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
						aria-label="Clear search"
					>
						<X className="h-4 w-4" />
					</button>
				)}
			</div>

			{/* One swipeable row on phones, wrapping rows with a "more" toggle from sm up. */}
			<div
				role="group"
				aria-label="Filter posts by tag"
				className={cn(
					"no-scrollbar -mx-4 max-w-none! flex gap-2 overflow-x-auto px-4 pb-1 snap-x scroll-px-4",
					"[mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]",
					"sm:mx-0 sm:max-w-full! sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 sm:scroll-px-0 sm:[mask-image:none]",
				)}
			>
				<button
					type="button"
					aria-pressed={selected.length === 0}
					onClick={() => selected.length > 0 && emitTags([])}
					className={cn(chipClass(selected.length === 0), "snap-start")}
				>
					All
				</button>
				{tags.map((tag, i) => {
					const active = selected.includes(tag.name);
					const collapsed = !expanded && !active && i >= COLLAPSED_TAG_COUNT;
					return (
						<button
							key={tag.name}
							type="button"
							aria-pressed={active}
							onClick={() => toggleTag(tag.name)}
							className={cn(
								chipClass(active),
								"snap-start",
								collapsed && "sm:hidden",
							)}
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
				{hiddenCount > 0 && (
					<button
						type="button"
						onClick={() => setExpanded((v) => !v)}
						aria-expanded={expanded}
						className="hidden sm:inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium text-primary hover:bg-primary/10"
					>
						{expanded ? "Show less" : `+${hiddenCount} more`}
					</button>
				)}
			</div>

			{filtering && result && (
				<div
					className="flex items-center gap-2 text-xs text-muted-foreground"
					aria-live="polite"
				>
					<span>
						<span className="font-semibold text-foreground tabular-nums">
							{result.visible}
						</span>{" "}
						of {result.total} posts
					</span>
					<span aria-hidden="true" className="text-border">
						·
					</span>
					<button
						type="button"
						onClick={clearAll}
						className="font-semibold text-primary hover:underline"
					>
						Clear filters
					</button>
				</div>
			)}

			{filtering && result?.visible === 0 && (
				<div className="rounded-xl border border-dashed border-border/60 px-4 py-10 text-center">
					<p className="text-sm font-medium text-foreground">No posts match</p>
					<p className="mt-1 text-xs text-muted-foreground">
						Try another search or fewer tags.
					</p>
				</div>
			)}
		</div>
	);
}
