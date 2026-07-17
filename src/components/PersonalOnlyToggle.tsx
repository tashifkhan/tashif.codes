import { useEffect, useState } from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

export const PERSONAL_ONLY_STORAGE_KEY = "github_personal_only";
export const PERSONAL_ONLY_EVENT = "github-personal-only-change";

export function getPersonalOnlyPreference(): boolean {
	if (typeof window === "undefined") return false;
	return localStorage.getItem(PERSONAL_ONLY_STORAGE_KEY) === "1";
}

export function dispatchPersonalOnlyChange(personalOnly: boolean) {
	document.dispatchEvent(
		new CustomEvent(PERSONAL_ONLY_EVENT, {
			detail: { personalOnly },
		})
	);
}

interface Props {
	className?: string;
}

/**
 * Toggle that filters GitHub stats/contributions to the personal account only.
 * Persists preference and broadcasts via `github-personal-only-change`.
 */
export default function PersonalOnlyToggle({ className }: Props) {
	const [enabled, setEnabled] = useState(false);
	const { trigger } = useWebHaptics();

	useEffect(() => {
		const saved = getPersonalOnlyPreference();
		setEnabled(saved);
		// Notify listeners of restored preference after mount
		if (saved) dispatchPersonalOnlyChange(true);
	}, []);

	const onToggle = () => {
		trigger("selection");
		const next = !enabled;
		setEnabled(next);
		localStorage.setItem(PERSONAL_ONLY_STORAGE_KEY, next ? "1" : "0");
		dispatchPersonalOnlyChange(next);
	};

	return (
		<button
			type="button"
			role="switch"
			aria-checked={enabled}
			aria-label="Show only personal GitHub contributions"
			title={
				enabled
					? "Showing personal account only — click to include work accounts"
					: "Showing all accounts — click to show personal only"
			}
			onClick={onToggle}
			className={cn(
				"group inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
				enabled && "border-primary/40 bg-primary/5 text-foreground",
				className
			)}
		>
			<span
				className={cn(
					"relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors",
					enabled ? "bg-primary" : "bg-muted-foreground/30"
				)}
			>
				<span
					className={cn(
						"inline-block h-3 w-3 rounded-full bg-background shadow-sm transition-transform",
						enabled ? "translate-x-3.5" : "translate-x-0.5"
					)}
				/>
			</span>
			<span className="whitespace-nowrap tabular-nums">
				{enabled ? "Personal only" : "All accounts"}
			</span>
		</button>
	);
}
