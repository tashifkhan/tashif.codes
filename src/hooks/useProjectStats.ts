import { useEffect, useRef, useState } from "react";

type StatsData = { metadata: { export_date: string } };
type Snapshot<T> = { slug: string; days: string; data: T };
type Result<T> = {
	data: T | null;
	error?: string;
	cache?: { stale: boolean; refreshing: boolean; refresh_error?: string; retry_after: number };
};

// Bounded page-session cache for switching between already visited periods.
const snapshots = new Map<string, StatsData>();

export function useProjectStats<T extends StatsData>(apiBase: string, slug: string, days: string) {
	const [snapshot, setSnapshot] = useState<Snapshot<T> | null>(null);
	const [loading, setLoading] = useState(false);
	const [slow, setSlow] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [revision, setRevision] = useState(0);
	const forceNext = useRef(false);

	useEffect(() => {
		if (!slug) return;
		const controller = new AbortController();
		let active = true;
		const key = `${apiBase}:${slug}:${days}`;
		const saved = snapshots.get(key) as T | undefined;
		if (saved) setSnapshot({ slug, days, data: saved });
		setLoading(true);
		setError(null);
		setSlow(false);
		const slowTimer = window.setTimeout(() => setSlow(true), 4000);
		const force = forceNext.current;
		forceNext.current = false;

		async function request(refresh: boolean): Promise<Result<T>> {
			const params = new URLSearchParams({ slugs: slug, days });
			if (refresh) params.set("refresh", "true");
			const deadline = window.setTimeout(() => controller.abort(new Error("Analytics took too long to respond. Try again.")), 305000);
			try {
				const response = await fetch(`${apiBase}/v1/stats?${params}`, { signal: controller.signal, cache: "no-store" });
				if (!response.ok) throw new Error(response.status === 504 ? "Analytics took too long to respond. Try again." : "Could not load analytics. Try again.");
				const body = await response.json();
				const result = body?.results?.[0] as Result<T> | undefined;
				if (!result) throw new Error("Analytics returned an invalid response.");
				return result;
			} finally {
				window.clearTimeout(deadline);
			}
		}

		function display(result: Result<T>) {
			if (!active || controller.signal.aborted) return;
			if (result.data) {
				setSnapshot({ slug, days, data: result.data });
				snapshots.delete(key);
				snapshots.set(key, result.data);
				if (snapshots.size > 20) snapshots.delete(snapshots.keys().next().value!);
			}
			const failure = result.error || result.cache?.refresh_error;
			if (failure) throw new Error(failure);
		}

		async function run() {
			try {
				let result = await request(force);
				display(result);
				if (!force && result.cache?.stale && !result.cache.refreshing && !result.cache.retry_after) {
					result = await request(true);
					display(result);
				}
				// Another function owns the refresh. Poll the snapshot, never start
				// another refresh while its lease is active.
				for (let attempt = 0; result.cache?.refreshing && attempt < 12; attempt++) {
					await new Promise<void>((resolve) => {
						const onAbort = () => { window.clearTimeout(timer); resolve(); };
						const timer = window.setTimeout(() => { controller.signal.removeEventListener("abort", onAbort); resolve(); }, 4000);
						controller.signal.addEventListener("abort", onAbort, { once: true });
					});
					if (!active || controller.signal.aborted) return;
					result = await request(false);
					display(result);
				}
				if (result.cache?.refreshing || !result.data) throw new Error("Stats are still being refreshed. Try again shortly.");
			} catch (err) {
				// Navigation/unmount aborts have no message; request deadlines do.
				if (active && (!controller.signal.aborted || controller.signal.reason?.name !== "AbortError")) {
					setError(err instanceof Error ? err.message : "Could not load analytics. Try again.");
				}
			} finally {
				if (active && (!controller.signal.aborted || controller.signal.reason?.name !== "AbortError")) setLoading(false);
				window.clearTimeout(slowTimer);
			}
		}
		void run();
		return () => { active = false; controller.abort(); window.clearTimeout(slowTimer); };
	}, [apiBase, slug, days, revision]);

	return { snapshot, loading, slow, error, refresh: () => { forceNext.current = true; setRevision((value) => value + 1); } };
}
