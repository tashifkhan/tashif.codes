"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
	AnimatePresence,
	MotionGlobalConfig,
	motion,
	useReducedMotion,
} from "motion/react";
import {
	ChevronDown,
	Monitor,
	Moon,
	Sun,
	Turtle,
	Vibrate,
	VibrateOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	hapticsEnabled,
	setHapticsEnabled,
	trigger,
} from "@/lib/haptics";
import {
	motionReduced,
	reduceMotionKey,
	setReduceMotion,
	systemReducesMotion,
} from "@/lib/motion";
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
	const reduced = motionReduced();
	const supportsTypes =
		typeof CSS !== "undefined" &&
		CSS.supports(`selector(:active-view-transition-type(${kind}))`);

	if (!document.startViewTransition || reduced) {
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
		// Older view-transition implementations do not understand types.
		// They still get the same reveal through the data-attribute
		// fallback selectors in studio-skin.css.
		const transition = document.startViewTransition(
			supportsTypes
				? ({ update, types: [kind] } as unknown as () => void)
				: update,
		);
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
	const [reduceOn, setReduceOn] = useState(false);
	const [systemReduce, setSystemReduce] = useState(false);
	const [expanded, setExpanded] = useState(true);
	const [visible, setVisible] = useState(true);
	const idleTimer = useRef<number | null>(null);
	const prefersReduced = useReducedMotion() || reduceOn;

	const pageScrollTop = () =>
		window.scrollY ||
		document.documentElement.scrollTop ||
		document.body.scrollTop ||
		0;

	useEffect(() => {
		const sync = () => {
			setMode(readMode());
			setSkin(readSkin());
			setHapticsOn(hapticsEnabled());
			setReduceOn(motionReduced());
			setSystemReduce(systemReducesMotion());
		};

		sync();
		setExpanded(pageScrollTop() < 96);
		setMounted(true);

		const onHaptics = () => setHapticsOn(hapticsEnabled());
		const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
		const onStorage = (event: StorageEvent) => {
			if (
				event.key === "theme" ||
				event.key === "tashif-skin" ||
				event.key === "site-haptics-enabled" ||
				event.key === reduceMotionKey
			) {
				if (event.key === reduceMotionKey) {
					document.documentElement.toggleAttribute(
						"data-reduce-motion",
						event.newValue === "true",
					);
				}
				sync();
			}
		};
		const onPageLoad = () => {
			setExpanded(pageScrollTop() < 96);
			setVisible(true);
		};

		window.addEventListener("haptics-preference-change", onHaptics);
		window.addEventListener("storage", onStorage);
		window.addEventListener("motion-preference-change", sync);
		motionQuery.addEventListener("change", sync);
		document.addEventListener("astro:page-load", onPageLoad);

		return () => {
			window.removeEventListener("haptics-preference-change", onHaptics);
			window.removeEventListener("storage", onStorage);
			window.removeEventListener("motion-preference-change", sync);
			motionQuery.removeEventListener("change", sync);
			document.removeEventListener("astro:page-load", onPageLoad);
		};
	}, []);

	// Motion-driven islands (charts, tooltips) skip their animations too.
	useEffect(() => {
		MotionGlobalConfig.skipAnimations = reduceOn;
	}, [reduceOn]);

	useEffect(() => {
		if (!expanded) return;

		const closeOnOutsidePress = (event: PointerEvent) => {
			const target = event.target;
			if (target instanceof Element && target.closest("[data-settings-dock]")) {
				return;
			}
			setExpanded(false);
		};

		document.addEventListener("pointerdown", closeOnOutsidePress, true);
		return () => {
			document.removeEventListener("pointerdown", closeOnOutsidePress, true);
		};
	}, [expanded]);

	useEffect(() => {
		if (!expanded || pageScrollTop() < 96) return;

		const timer = window.setTimeout(() => {
			const dock = document.querySelector("[data-settings-dock]");
			if (
				dock instanceof HTMLElement &&
				(dock.matches(":hover") || dock.contains(document.activeElement))
			) {
				return;
			}
			setExpanded(false);
		}, 5000);

		return () => window.clearTimeout(timer);
	}, [expanded]);

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
				setExpanded(pageScrollTop() < 96);
				setVisible(true);
			}, 220);
		};

		window.addEventListener("scroll", onScroll, { passive: true });
		// Capture scrolls inside nested scrollers too, not just window scroll.
		document.addEventListener("scroll", onScroll, {
			passive: true,
			capture: true,
		});
		window.addEventListener("touchmove", onScroll, { passive: true });
		window.addEventListener("wheel", onScroll, { passive: true });

		return () => {
			window.removeEventListener("scroll", onScroll);
			document.removeEventListener("scroll", onScroll, true);
			window.removeEventListener("touchmove", onScroll);
			window.removeEventListener("wheel", onScroll);
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

	const toggleReduceMotion = () => {
		trigger("selection");
		setReduceMotion(!document.documentElement.hasAttribute("data-reduce-motion"));
	};

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
						exit={{ opacity: 0, y: 12, scale: 0.6 }}
						transition={transition}
						className="w-[min(92vw,22rem)] rounded-[2rem] border border-border/60 bg-card/65 p-2.5 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.55)] ring-1 ring-white/10 backdrop-blur-2xl"
					>
						<div className="flex items-center justify-between px-1.5">
							<div className="flex items-center gap-1.5">
								<ThemeMark className="h-3 w-3 text-muted-foreground" />
								<span className="text-[10px] font-medium tracking-wide text-muted-foreground">
									Appearance
								</span>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								aria-label="Collapse appearance settings"
								title="Collapse"
								data-haptic="manual"
								onClick={() => {
									trigger("selection");
									setExpanded(false);
								}}
								className="-mr-1 h-9 w-9 rounded-full text-muted-foreground"
							>
								<ChevronDown className="h-3.5 w-3.5" />
							</Button>
						</div>

						<div
							role="radiogroup"
							aria-label="Theme mode"
							className="mt-2 grid grid-cols-3 gap-1 rounded-[1.25rem] bg-muted/50 p-1"
						>
							{MODES.map(({ value, label, icon: Icon }) => {
								const active = mode === value;
								return (
									<Button
										key={value}
										type="button"
										role="radio"
										aria-checked={active}
										aria-label={`${label} theme`}
										title={`${label} theme`}
										data-haptic="manual"
										variant={active ? "default" : "ghost"}
										size="sm"
										onClick={(event) => chooseMode(value, event)}
										className={cn(
											"h-8 gap-1 rounded-[1rem] px-1.5 text-[10px] font-medium sm:h-9 sm:gap-1.5 sm:px-2 sm:text-[11px]",
											active
												? "shadow-sm"
												: "text-muted-foreground hover:bg-background/60",
										)}
									>
										<Icon className="h-3.5 w-3.5" />
										<span>{label}</span>
									</Button>
								);
							})}
						</div>

						<div className="mt-2 grid grid-cols-[auto_1fr_1fr] gap-2">
							<div className="rounded-[1.35rem] border border-border/50 bg-background/40 p-2.5">
								<p className="text-[10px] font-medium tracking-wide text-muted-foreground">
									Accent
								</p>
								<div
									role="radiogroup"
									aria-label="Accent colour"
									className="mt-2 flex items-center gap-2"
								>
									{ACCENTS.map(({ value, label, color }) => {
										const active = skin === value;
										return (
											<Button
												key={value}
												type="button"
												role="radio"
												aria-checked={active}
												aria-label={label}
												title={label}
												data-haptic="manual"
												variant="ghost"
												size="icon"
												onClick={(event) => chooseSkin(value, event)}
												className={cn(
													"h-8 w-8 rounded-full p-0 transition-transform hover:scale-105",
													active
														? "ring-2 ring-foreground/60 ring-offset-2 ring-offset-card"
														: "",
												)}
											>
												<span
													className="h-5 w-5 rounded-full ring-1 ring-black/10"
													style={{ backgroundColor: color }}
												/>
											</Button>
										);
									})}
								</div>
							</div>

							<div className="rounded-[1.35rem] border border-border/50 bg-background/40 p-2.5">
								<p className="text-[10px] font-medium tracking-wide text-muted-foreground">
									Haptics
								</p>
								<div className="mt-2 flex items-center justify-between gap-2">
									{hapticsOn ? (
										<Vibrate className="h-3.5 w-3.5 shrink-0 text-primary" />
									) : (
										<VibrateOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
									)}
									<Switch
										on={hapticsOn}
										label="Haptic feedback"
										title={`Haptic feedback ${hapticsOn ? "on" : "off"}`}
										onToggle={toggleHaptics}
									/>
								</div>
							</div>

							<div className="rounded-[1.35rem] border border-border/50 bg-background/40 p-2.5">
								<p className="truncate text-[10px] font-medium tracking-wide text-muted-foreground">
									Reduce motion
								</p>
								<div className="mt-2 flex items-center justify-between gap-2">
									<Turtle
										className={cn(
											"h-3.5 w-3.5 shrink-0",
											reduceOn ? "text-primary" : "text-muted-foreground",
										)}
									/>
									<Switch
										on={reduceOn}
										label="Reduce motion"
										title={
											systemReduce
												? "Reduced by your system setting"
												: `Reduce motion ${reduceOn ? "on" : "off"}`
										}
										disabled={systemReduce}
										onToggle={toggleReduceMotion}
									/>
								</div>
							</div>
						</div>
					</motion.div>
				)}

				{visible && !expanded && (
					<motion.div
						key="collapsed"
						initial={prefersReduced ? false : { opacity: 0, scale: 0.5, y: 8 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.5 }}
						transition={transition}
						className="w-fit"
					>
						<Button
							type="button"
							aria-label="Open appearance settings"
							title="Appearance and haptics"
							data-haptic="manual"
							variant="ghost"
							size="icon"
							onClick={() => {
								trigger("selection");
								setExpanded(true);
							}}
							className="group h-[52px] w-[52px] rounded-full border border-border/60 bg-card/70 text-foreground shadow-xl ring-1 ring-white/10 backdrop-blur-2xl hover:bg-card/90"
						>
							<ThemeMark
								className="h-6 w-6 transition-transform duration-500 ease-out group-hover:rotate-180"
							/>
						</Button>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

function Switch({
	on,
	label,
	title,
	disabled = false,
	onToggle,
}: {
	on: boolean;
	label: string;
	title: string;
	disabled?: boolean;
	onToggle: () => void;
}) {
	return (
		<Button
			type="button"
			role="switch"
			aria-checked={on}
			aria-label={label}
			title={title}
			data-haptic="manual"
			variant="ghost"
			disabled={disabled}
			onClick={onToggle}
			className="h-8 rounded-full px-1.5"
		>
			<span
				className={cn(
					"relative h-5 w-9 rounded-full transition-colors",
					on ? "bg-primary" : "bg-muted-foreground/25",
				)}
			>
				<span
					className={cn(
						"absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm ring-1 ring-black/10 transition-transform",
						on ? "translate-x-4" : "translate-x-0",
					)}
				/>
			</span>
		</Button>
	);
}

/** A split swatch: the light/dark half in the text colour, the other half in
    the skin's accent. Stands for the whole dock without a separate dot. */
function ThemeMark({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
			<path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" />
			<path d="M12 3a9 9 0 0 1 0 18Z" fill="var(--primary)" />
			<circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
		</svg>
	);
}
