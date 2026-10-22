import { useState, useEffect } from "react";
import { Sun, Moon, Vibrate, VibrateOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trigger, hapticsEnabled, setHapticsEnabled } from "@/lib/haptics";

const themes = ["dark", "light"] as const;
type Theme = (typeof themes)[number];

/** The class on <html> is the source of truth, not React state. */
function readTheme(): Theme {
	if (typeof document === "undefined") return "light";
	const root = document.documentElement;
	if (root.classList.contains("dark")) return "dark";
	return "light";
}

export default function ThemeToggle() {
	const [hapticsOn, setHapticsOn] = useState(false);

	useEffect(() => {
		const sync = () => setHapticsOn(hapticsEnabled());
		const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
		sync();
		window.addEventListener("haptics-preference-change", sync);
		window.addEventListener("storage", sync);
		motion.addEventListener("change", sync);
		return () => {
			window.removeEventListener("haptics-preference-change", sync);
			window.removeEventListener("storage", sync);
			motion.removeEventListener("change", sync);
		};
	}, []);

	const toggleTheme = (event: React.MouseEvent<HTMLButtonElement>) => {
		trigger("selection");

		const root = document.documentElement;
		// One reveal at a time. Letting transitions overlap made the palette
		// snap between intermediate states.
		if (root.hasAttribute("data-theme-switch")) return;

		const current = readTheme();
		const next = themes[(themes.indexOf(current) + 1) % themes.length];

		const apply = () => {
			root.classList.remove("dark");
			if (next === "dark") root.classList.add("dark");
			root.style.colorScheme = next === "dark" ? "dark" : "light";
			try {
				localStorage.setItem("theme", next);
			} catch {}
		};

		const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const supportsTypes =
			typeof CSS !== "undefined" &&
			CSS.supports("selector(:active-view-transition-type(theme))");

		// The new palette is revealed as a circle growing from the button, in
		// both the original and studio skins. Browsers without the API repaint
		// instantly. The class change is synchronous, and the CSS transition
		// kill switch keeps the new snapshot from catching half-animated colors.
		if (document.startViewTransition && !reduced && supportsTypes) {
			const box = event.currentTarget.getBoundingClientRect();
			const x = box.left + box.width / 2;
			const y = box.top + box.height / 2;
			const radius = Math.hypot(
				Math.max(x, window.innerWidth - x),
				Math.max(y, window.innerHeight - y),
			);
			root.style.setProperty("--vt-x", `${x}px`);
			root.style.setProperty("--vt-y", `${y}px`);
			root.style.setProperty("--vt-r", `${radius}px`);
			root.dataset.themeSwitch = "";

			try {
				const transition = document.startViewTransition({
					update: apply,
					types: ["theme"],
				} as unknown as () => void);
				transition.finished.finally(() => {
					delete root.dataset.themeSwitch;
				});
			} catch {
				delete root.dataset.themeSwitch;
				apply();
			}
			return;
		}

		apply();
	};

	return (
		<>
			<Button
				variant="ghost"
				size="icon"
				onClick={toggleTheme}
				className="rounded-full hover:bg-muted"
				aria-label="Toggle theme"
				title="Switch theme"
			>
				<Sun className="theme-icon-sun h-5 w-5" />
				<span className="theme-icon-light">
					<Moon className="h-5 w-5" />
				</span>
			</Button>
			<Button
				variant="ghost"
				size="icon"
				type="button"
				className="rounded-full"
				data-haptic="manual"
				aria-label="Haptic feedback"
				aria-pressed={hapticsOn}
				title={`Haptic feedback ${hapticsOn ? "on" : "off"}`}
				onClick={() => {
					const enabled = !hapticsOn;
					setHapticsEnabled(enabled);
					if (enabled) trigger("selection");
				}}
			>
				{hapticsOn ? <Vibrate /> : <VibrateOff />}
			</Button>
		</>
	);
}
