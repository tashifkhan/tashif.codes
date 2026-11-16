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
import {
	DEFAULT_SKIN,
	SKIN_COLORS_KEY,
	SKIN_KEY,
	SKIN_STYLES,
	type SkinId,
} from "@/lib/skins";

type ThemeMode = "light" | "dark" | "system";
type Skin = SkinId;

/** Stylesheets for the styles that load on demand, set by Layout.astro. */
declare global {
	interface Window {
		__skinCss?: Record<string, string>;
	}
}

const MODES = [
	{ value: "light", label: "Light", icon: Sun },
	{ value: "dark", label: "Dark", icon: Moon },
	{ value: "system", label: "System", icon: Monitor },
] as const;

const styleOf = (skin: Skin) =>
	SKIN_STYLES.find((style) => style.id === skin) ?? SKIN_STYLES[0];

function readMode(): ThemeMode {
	if (typeof window === "undefined") return "system";
	const stored = localStorage.getItem("theme");
	return stored === "dark" || stored === "light" || stored === "system"
		? stored
		: "system";
}

function readSkin(): Skin {
	if (typeof document === "undefined") return "studio";
	const current = document.documentElement.dataset.skin;
	return SKIN_STYLES.some((style) => style.id === current)
		? (current as Skin)
		: DEFAULT_SKIN;
}

function readSavedColors(): Record<string, string> {
	try {
		return JSON.parse(localStorage.getItem(SKIN_COLORS_KEY) || "{}") ?? {};
	} catch {
		return {};
	}
}

/** The colour combo a style is showing: its saved one, or its first. */
function colorFor(skin: Skin): string {
	const style = styleOf(skin);
	const saved = readSavedColors()[skin];
	return style.colors.some((c) => c.id === saved) ? saved : style.colors[0].id;
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

/**
 * Links a lazy skin's stylesheet and resolves once it has loaded, so the
 * switch never shows a half-styled page. Simple and studio resolve at once.
 */
function loadSkin(skin: Skin): Promise<void> {
	const href = window.__skinCss?.[skin];
	if (!href || document.querySelector(`link[data-skin-css="${skin}"]`)) {
		return Promise.resolve();
	}
	return new Promise((resolve) => {
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.dataset.skinCss = skin;
		link.href = href;
		link.onload = () => resolve();
		// A failed load still switches, to the base palette, instead of hanging.
		link.onerror = () => resolve();
		document.head.append(link);
	});
}

/** Sets a style's colour combo. The first combo is the default: no attribute. */
function applyColor(skin: Skin, color: string, save = true) {
	const root = document.documentElement;
	if (color === styleOf(skin).colors[0].id) delete root.dataset.color;
	else root.dataset.color = color;
	if (!save) return;
	try {
		localStorage.setItem(
			SKIN_COLORS_KEY,
			JSON.stringify({ ...readSavedColors(), [skin]: color }),
		);
	} catch {}
}

function applySkin(skin: Skin) {
	document.documentElement.dataset.skin = skin;
	// Only the active skin's stylesheet stays linked.
	document
		.querySelectorAll(`link[data-skin-css]:not([data-skin-css="${skin}"])`)
		.forEach((link) => link.remove());
	applyColor(skin, colorFor(skin), false);
	try {
		localStorage.setItem(SKIN_KEY, skin);
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
	const [skin, setSkin] = useState<Skin>(DEFAULT_SKIN);
	const [color, setColor] = useState<string>(SKIN_STYLES[0].colors[0].id);
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
			setColor(colorFor(readSkin()));
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
				event.key === SKIN_KEY ||
				event.key === SKIN_COLORS_KEY ||
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
		const origin = event.currentTarget;
		// Fetch the stylesheet first, then reveal the new look in one wipe.
		void loadSkin(next).then(() => {
			runViewTransition("skin", origin, () => {
				applySkin(next);
				setSkin(next);
				setColor(colorFor(next));
			});
		});
	};

	const chooseColor = (
		next: string,
		event: MouseEvent<HTMLButtonElement>,
	) => {
		trigger("selection");
		if (next === color) return;
		runViewTransition("skin", event.currentTarget, () => {
			applyColor(skin, next);
			setColor(next);
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

						<div className="mt-2 grid grid-cols-2 gap-2">
							<div className="col-span-2 rounded-[1.35rem] border border-border/50 bg-background/40 p-2.5">
								<p
									id="dock-style-label"
									className="text-xs font-medium text-muted-foreground"
								>
									Style
								</p>
								<div
									role="radiogroup"
									aria-labelledby="dock-style-label"
									className="mt-2 grid grid-cols-5 gap-1.5"
								>
									{SKIN_STYLES.map((style) => {
										const active = skin === style.id;
										// Each tile previews the combo that style would open with.
										const shown =
											style.colors.find(
												(c) => c.id === (active ? color : colorFor(style.id)),
											) ?? style.colors[0];
										const ink = "#191713";
										return (
											<button
												key={style.id}
												type="button"
												role="radio"
												aria-checked={active}
												data-haptic="manual"
												onClick={(event) => chooseSkin(style.id, event)}
												className={cn(
													"group/style flex flex-col items-stretch gap-1.5 rounded-xl p-1 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
													active ? "bg-foreground/10" : "hover:bg-foreground/5",
												)}
											>
												<span
													aria-hidden="true"
													className="relative block h-11 overflow-hidden rounded-lg ring-1 ring-black/10"
													style={{ backgroundColor: shown.paper }}
												>
													{/* A sample card in the style's own corners, edge and shadow. */}
													<span
														className="absolute inset-x-1.5 top-2 bottom-[-6px] block bg-white/90 px-1.5 pt-1.5"
														style={{
															borderRadius: style.radius,
															border:
																style.edge === "ink"
																	? `1.5px solid ${ink}`
																	: style.edge === "hair"
																		? "1px solid rgb(0 0 0 / 0.14)"
																		: "none",
															boxShadow: style.stamp ? `2px 2px 0 ${ink}` : "none",
														}}
													>
														<span
															className="block h-1.5 w-6"
															style={{
																backgroundColor: shown.accent,
																borderRadius: style.radius > 8 ? 999 : style.radius / 3,
															}}
														/>
														<span
															className="mt-1 block h-1 w-full rounded-full"
															style={{ backgroundColor: "rgb(0 0 0 / 0.16)" }}
														/>
													</span>
												</span>
												<span
													className={cn(
														"text-[11px] leading-none",
														active
															? "font-semibold text-foreground"
															: "text-muted-foreground group-hover/style:text-foreground",
													)}
												>
													{style.name}
												</span>
											</button>
										);
									})}
								</div>

								<div className="mt-3 flex items-baseline justify-between gap-3">
									<p
										id="dock-color-label"
										className="text-xs font-medium text-muted-foreground"
									>
										Colour
									</p>
									<p className="truncate text-xs text-foreground">
										{styleOf(skin).colors.find((c) => c.id === color)?.name}
									</p>
								</div>
								<div
									role="radiogroup"
									aria-labelledby="dock-color-label"
									className="mt-2 flex flex-wrap items-center gap-2"
								>
									{styleOf(skin).colors.map((option) => {
										const active = color === option.id;
										return (
											<button
												key={option.id}
												type="button"
												role="radio"
												aria-checked={active}
												aria-label={option.name}
												title={option.name}
												data-haptic="manual"
												onClick={(event) => chooseColor(option.id, event)}
												className={cn(
													"h-8 w-8 rounded-full p-0.5 outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring",
													active &&
														"ring-2 ring-foreground/70 ring-offset-2 ring-offset-card",
												)}
											>
												{/* Paper on one half, accent on the other: the combo at a glance. */}
												<span
													className="block h-full w-full rounded-full ring-1 ring-black/15"
													style={{
														background: `linear-gradient(135deg, ${option.paper} 0 50%, ${option.accent} 50% 100%)`,
													}}
												/>
											</button>
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
