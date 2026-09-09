import { useState, useEffect } from "react";
import { Sun, Moon, Vibrate, VibrateOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trigger, hapticsEnabled, setHapticsEnabled } from "@/lib/haptics";

const themes = ["dark", "light", "cream"];

export default function ThemeToggle() {
	const [theme, setTheme] = useState("dark");
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

	useEffect(() => {
		const saved = localStorage.getItem("theme");
		if (saved) {
			setTheme(saved);
		} else {
			const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
				.matches
				? "dark"
				: "light";
			setTheme(systemTheme);
		}
	}, []);

	const toggleTheme = () => {
		trigger("selection");
		const idx = themes.indexOf(theme);
		const next = themes[(idx + 1) % themes.length];
		setTheme(next);
		document.documentElement.classList.remove("dark", "cream");
		if (next === "dark") {
			document.documentElement.classList.add("dark");
		} else if (next === "cream") {
			document.documentElement.classList.add("cream");
		}
		localStorage.setItem("theme", next);
	};

	return (
		<>
			<Button
				variant="ghost"
				size="icon"
				onClick={toggleTheme}
				className="rounded-full hover:bg-muted"
				aria-label="Toggle theme"
				title={`Switch theme (current: ${theme})`}
			>
				{theme === "dark" ? (
					<Sun className="h-5 w-5" />
				) : theme === "cream" ? (
					<span style={{ color: "#A47551" }}>
						<Moon className="h-5 w-5" />
					</span>
				) : (
					<Moon className="h-5 w-5" />
				)}
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
