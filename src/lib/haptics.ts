import { WebHaptics, type HapticInput } from "web-haptics";

// One brief pulse per effect, without a delayed second beat. Intensity 1
// preserves the duration instead of simulating amplitude with on/off timing.
// Browsers cannot control motor amplitude or reproduce native Pixel effects.
export const hapticPatterns = {
	selection: [{ duration: 4, intensity: 1 }],
	light: [{ duration: 6, intensity: 1 }],
	medium: [{ duration: 8, intensity: 1 }],
	success: [{ duration: 8, intensity: 1 }],
	error: [{ duration: 10, intensity: 1 }],
} satisfies Record<string, HapticInput>;
export type HapticKind = keyof typeof hapticPatterns;

let engine: WebHaptics | undefined;
let lastPulse = -Infinity;
let lastWasOutcome = false;
let requests = 0;
let installed = false;
let memoryPreference: boolean | undefined;
const preferenceKey = "site-haptics-enabled";

export function hapticsEnabled(): boolean {
	if (typeof window === "undefined") return false;
	try {
		const saved = localStorage.getItem(preferenceKey);
		if (saved !== null) return saved === "true";
	} catch { /* Storage can be blocked. Use the system preference. */ }
	if (memoryPreference !== undefined) return memoryPreference;
	return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function setHapticsEnabled(enabled: boolean): void {
	memoryPreference = enabled;
	try { localStorage.setItem(preferenceKey, String(enabled)); } catch { /* Optional persistence. */ }
	if (!enabled) engine?.cancel();
	window.dispatchEvent(new Event("haptics-preference-change"));
}

export function trigger(kind: HapticKind = "light"): void {
	requests++;
	if (typeof document === "undefined" || document.visibilityState === "hidden" || !hapticsEnabled()) return;
	if (!Object.hasOwn(hapticPatterns, kind)) return;
	const now = performance.now();
	const outcome = kind === "success" || kind === "error";
	// Coalesce duplicate handlers and immediate results into one pulse.
	// Later async outcomes still provide their own confirmation.
	if (now - lastPulse < (lastWasOutcome ? 180 : 100)) return;
	lastPulse = now;
	lastWasOutcome = outcome;
	try {
		engine ??= new WebHaptics({ debug: false, showSwitch: false });
		void engine.trigger(hapticPatterns[kind]).catch(() => {});
	} catch { /* Haptics must never interrupt an action. */ }
}

const controls = 'a[href], button, summary, [role="button"], [role="tab"], [role="menuitem"], [role="option"], [role="switch"], [role="checkbox"], [role="radio"], [data-haptic], [data-haptic-back], [data-haptic-nav], [data-haptic-external], [data-haptic-social]';

/** One delegate for Astro pages, React islands, portals and generated content. */
export function installHaptics(): void {
	if (installed || typeof document === "undefined") return;
	installed = true;
	document.addEventListener("click", (event) => {
		if (!event.isTrusted || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
		if (!(event.target instanceof Element)) return;
		const control = event.target.closest<HTMLElement>(controls);
		if (!control || control.closest('[disabled], [aria-disabled="true"], [inert], [data-haptic="off"], [data-haptic="manual"]')) return;
		if (control.matches('[aria-selected="true"], [aria-current="page"], [role="radio"][aria-checked="true"]')) return;
		const declared = control.dataset.haptic;
		const kind: HapticKind = declared && Object.hasOwn(hapticPatterns, declared)
			? declared as HapticKind
			: control.matches('summary, [role="tab"], [role="option"], [role="switch"], [role="checkbox"], [role="radio"], [aria-pressed], [aria-expanded]')
				? "selection" : "light";
		const before = requests;
		// Capture the pre-click state, then let action-specific handlers take
		// precedence. This also covers handlers that stop event propagation.
		setTimeout(() => {
			// Astro intercepts anchors for client navigation.
			if (requests === before && (!event.defaultPrevented || control.matches("a[href]"))) trigger(kind);
		}, 0);
	}, true);

	document.addEventListener("change", (event) => {
		if (!event.isTrusted || !(event.target instanceof HTMLElement)) return;
		const control = event.target;
		if (control.closest('[disabled], [aria-disabled="true"], [inert], [data-haptic="off"], [data-haptic="manual"]')) return;
		if (control.matches('select, input[type="checkbox"], input[type="radio"], input[type="range"]')) trigger("selection");
	});

	document.addEventListener("invalid", (event) => {
		// Native form validation can stop submission before its handler runs.
		if (event.isTrusted && navigator.userActivation?.isActive) trigger("error");
	}, true);

	// Inline Astro scripts cannot import modules. Keep their outcomes on the
	// same engine and policy as bundled scripts and React handlers.
	document.addEventListener("site:haptic", (event) => {
		const kind = (event as CustomEvent).detail;
		if (typeof kind === "string" && Object.hasOwn(hapticPatterns, kind)) trigger(kind as HapticKind);
	});
	const cancel = () => { engine?.cancel(); lastPulse = -Infinity; };
	document.addEventListener("visibilitychange", () => { if (document.hidden) cancel(); });
	document.addEventListener("astro:before-swap", cancel);
	window.addEventListener("pagehide", cancel);
}
