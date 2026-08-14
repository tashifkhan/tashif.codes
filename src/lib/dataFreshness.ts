/** Shared helpers for last-fetched timestamps and client refresh bookkeeping. */
import type { LiveDataSource } from "@/types";


const STORAGE_PREFIX = "live-fetched-at:";

export function formatFetchedAt(
	iso: string | null | undefined,
	/** Pass an explicit "now" so SSR can avoid baking a stale "just now". */
	nowMs: number = Date.now(),
): {
	relative: string;
	absolute: string;
} {
	if (!iso) {
		return { relative: "unknown", absolute: "Unknown" };
	}
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) {
		return { relative: "unknown", absolute: "Unknown" };
	}

	const absolute = date.toLocaleString(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	});

	const diffMs = nowMs - date.getTime();
	// Future / clock-skew: treat as just now rather than negative ages
	const sec = Math.max(0, Math.round(diffMs / 1000));
	if (sec < 45) return { relative: "just now", absolute };
	const min = Math.round(sec / 60);
	if (min < 60) return { relative: `${min}m ago`, absolute };
	const hr = Math.round(min / 60);
	if (hr < 24) return { relative: `${hr}h ago`, absolute };
	const day = Math.round(hr / 24);
	if (day < 30) return { relative: `${day}d ago`, absolute };

	return { relative: absolute, absolute };
}

export function readStoredFetchedAt(source: LiveDataSource): string | null {
	if (typeof window === "undefined") return null;
	try {
		return sessionStorage.getItem(STORAGE_PREFIX + source);
	} catch {
		return null;
	}
}

export function writeStoredFetchedAt(source: LiveDataSource, iso: string): void {
	if (typeof window === "undefined") return;
	try {
		sessionStorage.setItem(STORAGE_PREFIX + source, iso);
	} catch {
		// ignore quota / private mode
	}
}

/** Prefer the newer of build-time vs client-refreshed timestamps. */
export function resolveFetchedAt(
	source: LiveDataSource | undefined,
	buildTimeIso: string | null | undefined,
): string {
	const build = buildTimeIso ?? "";
	if (!source) return build;
	const stored = readStoredFetchedAt(source);
	if (!stored) return build;
	if (!build) return stored;
	return new Date(stored).getTime() >= new Date(build).getTime() ? stored : build;
}

export const LIVE_REFRESH_EVENT = "live-data-refreshed";

export function dispatchLiveRefreshed(
	source: LiveDataSource,
	fetchedAt: string,
): void {
	if (typeof document === "undefined") return;
	document.dispatchEvent(
		new CustomEvent(LIVE_REFRESH_EVENT, {
			detail: { source, fetchedAt },
		}),
	);
}

