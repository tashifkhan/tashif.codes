"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
	Check,
	ChevronDown,
	Monitor,
	Moon,
	SlidersHorizontal,
	Sun,
	Vibrate,
	VibrateOff,
} from "lucide-react";
import {
	hapticsEnabled,
	setHapticsEnabled,
	trigger,
} from "@/lib/haptics";
import { cn } from "@/lib/utils";

type ThemeMode = "light" | "dark" | "system";
type Skin = "simple" | "studio";

const MODES = [
	{ value: "light", label: "Light", icon: Sun },
	{ value: "dark", label: "Dark", icon: Moon },
	{ value: "system", label: "System", icon: Monitor },
] as const;

const ACCENTS = [
	{ value: "simple", label: "Orange accent", color: "#f97316" },
	{ value: "studio", label: "Green accent", color: "#0f7a6c" },
] as const;

function readMode(): ThemeMode {
	if (typeof window === "undefined") return "system";
	const stored = localStorage.getItem("theme");
	return stored === "dark" || stored === "light" || stored === "system"
		? stored
		: "system";
}

function readSkin(): Skin {
	if (typeof document === "undefined") return "simple";
	return document.documentElement.dataset.skin === "studio" ? "studio" : "simple";
}

function systemIsDark(): boolean {
	return matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolvedDark(mode: ThemeMode): boolean {
	return mode === "dark" || (mode === "system" && systemIsDark());
}

function applyMode(mode: ThemeMode) {
	const root = document.documentElement;
	const dark = resolvedDark(mode);
	root.classList.toggle("dark", dark);
	root.style.colorScheme = dark ? "dark" : "light";
	root.dataset.themeMode = mode;
	try {
		localStorage.setItem("theme", mode);
	} catch {}
}

function applySkin(skin: Skin) {
	document.documentElement.dataset.skin = skin;
	try {
		localStorage.setItem("tashif-skin", skin);
	} catch {}
}

function runViewTransition(
	kind: "theme" | "skin",
	origin: HTMLElement,
	update: () => void,
) {
	const root = document.documentElement;
	const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
	const supportsTypes =
		typeof CSS !== "undefined" &&
		CSS.supports(`selector(:active-view-transition-type(${kind}))`);

	if (!document.startViewTransition || reduced || !supportsTypes) {
		update();
		return;
	}

	const box = origin.getBoundingClientRect();
	const x = box.left + box.width / 2;
	const y = box.top + box.height / 2;
	const radius = Math.hypot(
		Math.max(x, innerWidth - x),
		Math.max(y, innerHeight - y),
	);

	root.style.setProperty("--vt-x", `${x}px`);
	root.style.setProperty("--vt-y", `${y}px`);
	root.style.setProperty("--vt-r", `${radius}px`);
	const attribute = kind === "theme" ? "themeSwitch" : "skinSwitch";
	root.dataset[attribute] = "";

	try {
		const transition = document.startViewTransition({
			update,
			types: [kind],
		} as unknown as () => void);
		transition.finished.finally(() => {
			delete root.dataset[attribute];
		});
	} catch {
		delete root.dataset[attribute];
		update();
	}
}

export default function SettingsDock() {
	const [mounted, setMounted] = useState(false);
	const [mode, setMode] = useState<ThemeMode>("system");
	const [skin, setSkin] = useState<Skin>("simple");
	const [hapticsOn, setHapticsOn] = useState(false);
	const [expanded, setExpanded] = useState(true);
	const [visible, setVisible] = useState(true);
	const idleTimer = useRef<number | null>(null);
	const prefersReduced = useReducedMotion();

	useEffect(() => {
		const sync = () => {
			setMode(readMode());
			setSkin(readSkin());
			setHapticsOn(hapticsEnabled());
		};

		sync();
		setMounted(true);

		const onHaptics = () => setHapticsOn(hapticsEnabled());
		const onStorage = (event: StorageEvent) => {
			if (
				event.key === "theme" ||
				event.key === "tashif-skin" ||
				event.key === "site-haptics-enabled"
			) {
				sync();
			}
		};

		window.addEventListener("haptics-preference-change", onHaptics);
		window.addEventListener("storage", onStorage);

		return () => {
			window.removeEventListener("haptics-preference-change", onHaptics);
			window.removeEventListener("storage", onStorage);
		};
	}, []);

	useEffect(() => {
		let wasScrolling = false;

		const onScroll = () => {
			if (!wasScrolling) {
				wasScrolling = true;
				setVisible(false);
			}

			if (idleTimer.current) window.clearTimeout(idleTimer.current);
			idleTimer.current = window.setTimeout(() => {
				wasScrolling = false;
				setExpanded(window.scrollY < 96);
				setVisible(true);
			}, 220);
		};

		window.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			window.removeEventListener("scroll", onScroll);
			if (idleTimer.current) window.clearTimeout(idleTimer.current);
		};
	}, []);

	const chooseMode = (
		next: ThemeMode,
		event: MouseEvent<HTMLButtonElement>,
	) => {
		if (next === mode) {
			trigger("selection");
			return;
		}

		trigger("selection");
		runViewTransition("theme", event.currentTarget, () => {
			applyMode(next);
			setMode(next);
		});
	};

	const chooseSkin = (
		next: Skin,
		event: MouseEvent<HTMLButtonElement>,
	) => {
		if (next === skin) {
			trigger("selection");
			return;
		}

		trigger("selection");
		runViewTransition("skin", event.currentTarget, () => {
			applySkin(next);
			setSkin(next);
		});
	};

	const toggleHaptics = () => {
		const next = !hapticsOn;
		setHapticsEnabled(next);
		setHapticsOn(next);
		if (next) trigger("selection");
	};

	const accentColor = skin === "studio" ? "#0f7a6c" : "#f97316";
	const transition = prefersReduced
		? { duration: 0 }
		: { type: "spring" as const, stiffness: 380, damping: 30 };

	if (!mounted) return null;

	return (
		<div
			className="fixed bottom-4 left-4 z-[70] print:hidden sm:bottom-6 sm:left-6"
			data-settings-dock
		>
			<AnimatePresence mode="wait" initial={false}>
				{visible && expanded && (
					<motion.div
						key="expanded"
						role="group"
						aria-label="Appearance and haptics"
						initial={
							prefersReduced
								? false
								: { opacity: 0, y: 14, scale: 0.92 }
						}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 10, scale: 0.55 }}
						transition={transition}
						className="flex items-center gap-1 rounded-2xl border border-border/70 bg-card/90 p-1 shadow-xl backdrop-blur-xl sm:gap-1.5 sm:p-1.5"
					>
						<div
							role="radiogroup"
							aria-label="Theme mode"
							className="flex items-center gap-0.5 rounded-full bg-muted/40 p-0.5"
						>
							{MODES.map(({ value, label, icon: Icon }) => {
								const active = mode === value;
								return (
									<button
										key={value}
										type="button"
										role="radio"
										aria-checked={active}
										aria-label={`${label} theme`}
										title={`${label} theme`}
										data-haptic="manual"
										onClick={(event) => chooseMode(value, event)}
										className={cn(
											"grid h-7 w-7 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:h-8 sm:w-8",
											active
												? "bg-primary/15 text-primary shadow-sm"
												: "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
										)}
									>
										<Icon size={14} strokeWidth={1.8} />
									</button>
								);
							})}
						</div>

						<span className="h-4 w-px bg-border/70 sm:h-5" aria-hidden="true" />

						<div
							role="radiogroup"
							aria-label="Accent colour"
							className="flex items-center gap-1 px-0.5"
						>
							{ACCENTS.map(({ value, label, color }) => {
								const active = skin === value;
								return (
									<button
										key={value}
										type="button"
										role="radio"
										aria-checked={active}
										aria-label={label}
										title={label}
										data-haptic="manual"
										onClick={(event) => chooseSkin(value, event)}
										className={cn(
											"grid h-6 w-6 place-items-center rounded-full transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:h-7 sm:w-7",
											active
												? "ring-2 ring-foreground/50 ring-offset-2 ring-offset-card"
												: "",
										)}
									>
										<span
											className="grid h-4 w-4 place-items-center rounded-full"
											style={{ backgroundColor: color }}
										>
											{active && (
												<Check
													size={9}
													strokeWidth={3}
													className="text-white"
												/>
											)}
										</span>
									</button>
								);
							})}
						</div>

						<span className="h-4 w-px bg-border/70 sm:h-5" aria-hidden="true" />

						<button
							type="button"
							role="switch"
							aria-checked={hapticsOn}
							aria-label="Haptic feedback"
							title={`Haptic feedback ${hapticsOn ? "on" : "off"}`}
							data-haptic="manual"
							onClick={toggleHaptics}
							className="flex h-7 items-center gap-1.5 rounded-full px-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:h-8"
						>
							{hapticsOn ? (
								<Vibrate size={14} strokeWidth={1.8} />
							) : (
								<VibrateOff size={14} strokeWidth={1.8} />
							)}
							<span
								className={cn(
									"relative h-4 w-7 rounded-full transition-colors",
									hapticsOn ? "bg-primary" : "bg-muted-foreground/25",
								)}
							>
								<span
									className={cn(
										"absolute top-0.5 h-3 w-3 rounded-full bg-background shadow transition-transform",
										hapticsOn ? "translate-x-3.5" : "translate-x-0.5",
									)}
								/>
							</span>
						</button>

						<button
							type="button"
							aria-label="Collapse appearance settings"
							title="Collapse"
							data-haptic="manual"
							onClick={() => {
								trigger("selection");
								setExpanded(false);
							}}
							className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:h-8 sm:w-8"
						>
							<ChevronDown size={15} strokeWidth={1.8} />
						</button>
					</motion.div>
				)}

				{visible && !expanded && (
					<motion.button
						key="collapsed"
						type="button"
						aria-label="Open appearance settings"
						title="Appearance and haptics"
						data-haptic="manual"
						initial={prefersReduced ? false : { opacity: 0, scale: 0.5, y: 8 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.5 }}
						transition={transition}
						onClick={() => {
							trigger("selection");
							setExpanded(true);
						}}
						className="relative grid h-11 w-11 place-items-center rounded-full border border-border/70 bg-card/90 text-foreground shadow-xl backdrop-blur-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
					>
						<SlidersHorizontal size={18} strokeWidth={1.8} />
						<span
							className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-card"
							style={{ backgroundColor: accentColor }}
						/>
					</motion.button>
				)}
			</AnimatePresence>
		</div>
	);
}
