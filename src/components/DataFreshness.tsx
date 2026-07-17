import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, RefreshCw, X } from "lucide-react";
import { useWebHaptics } from "web-haptics/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
	formatFetchedAt,
	resolveFetchedAt,
	writeStoredFetchedAt,
	LIVE_REFRESH_EVENT,
	type LiveDataSource,
	type LiveRefreshDetail,
} from "@/lib/dataFreshness";
import { friendlyFetchError, refreshLiveSource } from "@/lib/liveRefresh";

const SOURCE_LABELS: Record<LiveDataSource, string> = {
	github: "GitHub stats",
	leetcode: "LeetCode stats",
	projects: "Projects data",
	"project-stats": "Project analytics",
	blog: "Blog posts",
};

export interface DataFreshnessProps {
	/** ISO timestamp from build-time / server fetch */
	fetchedAt: string;
	/** Built-in live source (client re-fetch + DOM patch) */
	source?: LiveDataSource;
	/** Override title in the modal */
	label?: string;
	/** Extra explanation under the title */
	description?: string;
	/**
	 * Custom refresh handler (e.g. project-stats React state).
	 * When provided, takes precedence over the built-in source refresh.
	 */
	onRefresh?: () => Promise<void>;
	className?: string;
	/**
	 * denser chip for toolbar/header rows.
	 * On small screens the chip already drops the “Fetched” prefix.
	 */
	compact?: boolean;
}

export default function DataFreshness({
	fetchedAt: buildFetchedAt,
	source,
	label,
	description,
	onRefresh,
	className,
	compact = false,
}: DataFreshnessProps) {
	const [fetchedAt, setFetchedAt] = useState(() =>
		resolveFetchedAt(source, buildFetchedAt),
	);
	const [open, setOpen] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [nowTick, setNowTick] = useState(0);
	const dialogRef = useRef<HTMLDialogElement>(null);
	const { trigger } = useWebHaptics();

	const displayLabel = label ?? (source ? SOURCE_LABELS[source] : "Data");

	// Keep relative labels fresh
	useEffect(() => {
		if (!fetchedAt) return;
		const id = window.setInterval(() => setNowTick((t) => t + 1), 30_000);
		return () => window.clearInterval(id);
	}, [fetchedAt]);

	// Sync if another chip for the same source refreshes
	useEffect(() => {
		if (!source) return;
		const onEvent = (e: Event) => {
			const detail = (e as CustomEvent<LiveRefreshDetail>).detail;
			if (detail?.source === source && detail.fetchedAt) {
				setFetchedAt(detail.fetchedAt);
			}
		};
		document.addEventListener(LIVE_REFRESH_EVENT, onEvent);
		return () => document.removeEventListener(LIVE_REFRESH_EVENT, onEvent);
	}, [source]);

	// Re-resolve when build prop changes (view transitions)
	useEffect(() => {
		setFetchedAt(resolveFetchedAt(source, buildFetchedAt));
	}, [buildFetchedAt, source]);

	useEffect(() => {
		const el = dialogRef.current;
		if (!el) return;
		if (open) {
			if (!el.open) el.showModal();
		} else if (el.open) {
			el.close();
		}
	}, [open]);

	const labels = useMemo(() => {
		void nowTick;
		return formatFetchedAt(fetchedAt);
	}, [fetchedAt, nowTick]);

	const openModal = useCallback(() => {
		if (refreshing) return;
		trigger("selection");
		setError(null);
		setOpen(true);
	}, [refreshing, trigger]);

	const closeModal = useCallback(() => {
		if (refreshing) return;
		setOpen(false);
		setError(null);
	}, [refreshing]);

	const confirmRefresh = useCallback(async () => {
		if (refreshing) return;
		trigger("selection");
		setRefreshing(true);
		setError(null);
		try {
			if (onRefresh) {
				await onRefresh();
				const at = new Date().toISOString();
				if (source) {
					writeStoredFetchedAt(source, at);
				}
				setFetchedAt(at);
			} else if (source && source !== "project-stats") {
				const at = await refreshLiveSource(source);
				setFetchedAt(at);
			} else {
				throw new Error("No refresh handler configured");
			}
			setOpen(false);
			trigger("success");
		} catch (err) {
			console.error(err);
			setError(friendlyFetchError(err, "Refresh failed. Try again."));
			trigger("error");
		} finally {
			setRefreshing(false);
		}
	}, [refreshing, onRefresh, source, trigger]);

	const defaultDescription =
		description ??
		`Re-fetch live ${displayLabel.toLowerCase()} from the source APIs. This bypasses caches and may take a few seconds.`;

	return (
		<>
			<button
				type="button"
				onClick={openModal}
				disabled={refreshing}
				title={`${labels.absolute} — tap to refresh`}
				aria-label={`${displayLabel} last fetched ${labels.absolute}. Tap to refresh.`}
				className={cn(
					// Base pill — stays on one header row
					"inline-flex items-center gap-1 rounded-full border border-border/60",
					"bg-muted/30 sm:bg-card/70",
					compact
						? "h-7 max-w-[5.5rem] sm:max-w-none px-1.5 sm:px-2.5"
						: "h-7 sm:h-8 px-2 sm:px-3",
					"text-[10px] sm:text-[11px] font-medium text-muted-foreground",
					"hover:border-primary/40 hover:text-foreground hover:bg-muted/50 active:scale-[0.98]",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
					"disabled:opacity-60 disabled:pointer-events-none",
					"transition-colors cursor-pointer group touch-manipulation shrink-0",
					className,
				)}
			>
				{refreshing ? (
					<RefreshCw
						className="w-3 h-3 text-primary animate-spin shrink-0"
						aria-hidden="true"
					/>
				) : (
					<Clock
						className="w-3 h-3 text-primary/70 group-hover:text-primary transition-colors shrink-0"
						aria-hidden="true"
					/>
				)}
				<span className="font-mono tracking-tight tabular-nums whitespace-nowrap truncate">
					{refreshing ? (
						<span className="text-foreground/80">…</span>
					) : (
						<>
							{/* Mobile compact: short relative (e.g. "11m") · sm+: full */}
							<span className="text-foreground/90 sm:hidden">
								{labels.relative.replace(/\s*ago$/i, "")}
							</span>
							<span className="hidden sm:inline">
								<span className="text-muted-foreground/70">Fetched</span>{" "}
								<span className="text-foreground/90">{labels.relative}</span>
								{!compact && (
									<span className="text-muted-foreground/50 group-hover:text-primary/70 transition-colors">
										{" "}
										· refresh
									</span>
								)}
							</span>
						</>
					)}
				</span>
			</button>

			<dialog
				ref={dialogRef}
				aria-labelledby="data-freshness-title"
				aria-describedby="data-freshness-desc"
				onCancel={(e) => {
					if (refreshing) {
						e.preventDefault();
						return;
					}
					setOpen(false);
					setError(null);
				}}
				onClick={(e) => {
					if (e.target === dialogRef.current && !refreshing) {
						closeModal();
					}
				}}
				className={cn(
					// Mobile: bottom sheet · Desktop: centered modal
					"fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none",
					"sm:inset-auto sm:m-auto sm:w-[calc(100vw-2rem)] sm:max-w-md sm:bottom-auto",
					"rounded-t-2xl sm:rounded-2xl border border-border bg-card text-foreground p-0 shadow-2xl",
					"backdrop:bg-black/60 backdrop:backdrop-blur-sm",
					"open:flex open:flex-col",
					// Safe area for home indicator
					"pb-[max(0.5rem,env(safe-area-inset-bottom))]",
				)}
			>
				{/* Drag handle (mobile only) */}
				<div
					className="sm:hidden flex justify-center pt-2.5 pb-0.5"
					aria-hidden="true"
				>
					<div className="h-1 w-9 rounded-full bg-muted-foreground/25" />
				</div>

				<div className="flex items-start gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-border/60">
					<div className="mt-0.5 h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
						<RefreshCw
							className={cn("w-4 h-4 text-primary", refreshing && "animate-spin")}
							aria-hidden="true"
						/>
					</div>
					<div className="flex-1 min-w-0 pt-0.5">
						<h2
							id="data-freshness-title"
							className="text-base font-semibold text-foreground tracking-tight"
						>
							Refresh {displayLabel.toLowerCase()}?
						</h2>
						<p
							id="data-freshness-desc"
							className="text-sm text-muted-foreground mt-1 leading-relaxed"
						>
							{defaultDescription}
						</p>
					</div>
					<button
						type="button"
						onClick={closeModal}
						disabled={refreshing}
						aria-label="Close"
						className="h-8 w-8 -mr-1 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0 cursor-pointer disabled:opacity-40 disabled:pointer-events-none touch-manipulation"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				<div className="px-4 sm:px-6 py-3.5 sm:py-4 space-y-3">
					<div className="rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 font-mono text-xs text-muted-foreground space-y-1.5">
						<div className="flex justify-between gap-3">
							<span className="text-muted-foreground/70">Last fetched</span>
							<span className="text-foreground/90 text-right">{labels.absolute}</span>
						</div>
						<div className="flex justify-between gap-3">
							<span className="text-muted-foreground/70">Relative</span>
							<span className="text-foreground/90">{labels.relative}</span>
						</div>
						{source && (
							<div className="flex justify-between gap-3">
								<span className="text-muted-foreground/70">Source</span>
								<span className="text-foreground/90">{source}</span>
							</div>
						)}
					</div>

					{error && (
						<p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
							{error}
						</p>
					)}
				</div>

				<div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 px-4 sm:px-6 py-3.5 sm:py-4 border-t border-border/60">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={closeModal}
						disabled={refreshing}
						className="w-full sm:w-auto h-10 sm:h-8 touch-manipulation"
					>
						Cancel
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={confirmRefresh}
						disabled={refreshing}
						className="w-full sm:w-auto sm:min-w-[7.5rem] h-10 sm:h-8 touch-manipulation"
					>
						{refreshing ? (
							<>
								<RefreshCw className="w-3.5 h-3.5 animate-spin" />
								Refreshing…
							</>
						) : (
							<>
								<RefreshCw className="w-3.5 h-3.5" />
								Refresh now
							</>
						)}
					</Button>
				</div>
			</dialog>
		</>
	);
}
