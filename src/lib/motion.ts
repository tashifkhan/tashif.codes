/**
 * Site-level reduced motion. The OS setting always wins; the settings dock can
 * also turn motion down on its own by putting data-reduce-motion on <html>
 * (restored before first paint by Layout.astro). Scripts check
 * motionReduced() instead of the media query so both sources count.
 */

export const reduceMotionKey = "site-reduce-motion";
const query = "(prefers-reduced-motion: reduce)";

export function systemReducesMotion(): boolean {
	if (typeof window === "undefined") return false;
	return window.matchMedia(query).matches;
}

export function motionReduced(): boolean {
	if (typeof document === "undefined") return false;
	return (
		document.documentElement.hasAttribute("data-reduce-motion") ||
		systemReducesMotion()
	);
}

export function setReduceMotion(enabled: boolean): void {
	document.documentElement.toggleAttribute("data-reduce-motion", enabled);
	try {
		localStorage.setItem(reduceMotionKey, String(enabled));
	} catch { /* Optional persistence. */ }
	window.dispatchEvent(new Event("motion-preference-change"));
}
