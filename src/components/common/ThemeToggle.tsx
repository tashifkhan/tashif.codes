import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWebHaptics } from "web-haptics/react";

const themes = ["dark", "light", "cream"];

export default function ThemeToggle() {
	const [theme, setTheme] = useState("dark");
	const { trigger } = useWebHaptics();

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
		trigger("medium");
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
	);
}
