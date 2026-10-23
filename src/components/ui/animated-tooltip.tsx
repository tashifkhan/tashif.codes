"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { trigger } from "@/lib/haptics";
import {
	motion,
	AnimatePresence,
	useMotionValue,
	useSpring,
	useTransform,
} from "motion/react";

type TooltipItem = {
	id: number;
	name: string;
	designation: string;
	image: string;
	url?: string;
};

type ActiveTooltip = {
	item: TooltipItem;
	rect: DOMRect;
	placement: "left" | "center" | "right";
};

export const AnimatedTooltip = ({ items }: { items: TooltipItem[] }) => {
	const [active, setActive] = useState<ActiveTooltip | null>(null);
	const [open, setOpen] = useState(false);
	const [mounted, setMounted] = useState(false);

	const springConfig = { stiffness: 100, damping: 15 };
	const x = useMotionValue(0);
	const animationFrameRef = useRef<number | null>(null);

	const rotate = useSpring(
		useTransform(x, [-100, 100], [-45, 45]),
		springConfig,
	);
	const translateX = useSpring(
		useTransform(x, [-100, 100], [-50, 50]),
		springConfig,
	);

	useEffect(() => {
		setMounted(true);
		return () => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
		};
	}, []);

	useEffect(() => {
		if (!open) return;

		const close = () => setOpen(false);
		window.addEventListener("scroll", close, { passive: true });
		window.addEventListener("resize", close);

		return () => {
			window.removeEventListener("scroll", close);
			window.removeEventListener("resize", close);
		};
	}, [open]);

	const handleMouseMove = (event: React.MouseEvent<HTMLImageElement>) => {
		if (animationFrameRef.current) {
			cancelAnimationFrame(animationFrameRef.current);
		}

		animationFrameRef.current = requestAnimationFrame(() => {
			const target = event.target as HTMLImageElement;
			const halfWidth = target.offsetWidth / 2;
			x.set(event.nativeEvent.offsetX - halfWidth);
		});
	};

	const show = (item: TooltipItem, index: number, element: HTMLElement) => {
		const rect = element.getBoundingClientRect();
		const placement: ActiveTooltip["placement"] =
			index === 0 ? "left" : index === items.length - 1 ? "right" : "center";

		setActive({ item, rect, placement });
		setOpen(true);
	};

	return (
		<>
			{items.map((item, idx) => (
				<a
					href={item.url}
					target="_blank"
					rel="noopener noreferrer"
					className="group relative -mr-2 last:mr-0 block cursor-pointer"
					key={item.id}
					onClick={() => trigger("light")}
					onMouseEnter={(event) =>
						show(item, idx, event.currentTarget)
					}
					onMouseLeave={() => setOpen(false)}
					onFocus={(event) => show(item, idx, event.currentTarget)}
					onBlur={() => setOpen(false)}
					aria-label={`${item.name}, ${item.designation}`}
				>
					<img
						onMouseMove={handleMouseMove}
						height={100}
						width={100}
						src={item.image}
						alt={item.name}
						className="relative !m-0 h-10 w-10 rounded-full border-2 border-white object-cover object-top !p-0 transition duration-500 group-hover:z-30 group-hover:scale-105 dark:border-gray-900"
					/>
				</a>
			))}

			{mounted &&
				active &&
				createPortal(
					<AnimatePresence>
						{open &&
							(() => {
								const above = active.rect.top > 100;
								const left =
									active.placement === "left"
										? active.rect.left
										: active.placement === "right"
											? active.rect.right
											: active.rect.left + active.rect.width / 2;
								const top = above
									? active.rect.top - 4
									: active.rect.bottom + 6;
								const shiftX =
									active.placement === "left"
										? "0%"
										: active.placement === "right"
											? "-100%"
											: "-50%";
								const shiftY = above ? "-100%" : "0%";

								return (
									<motion.div
										key={active.item.id}
										initial={{ opacity: 0, y: 20, scale: 0.6 }}
										animate={{
											opacity: 1,
											y: 0,
											scale: 1,
											transition: {
												type: "spring",
												stiffness: 260,
												damping: 10,
											},
										}}
										exit={{ opacity: 0, y: 20, scale: 0.6 }}
										className="pointer-events-none fixed z-[9999]"
										style={{ left, top }}
									>
										<div
											style={{
												transform: `translate(${shiftX}, ${shiftY})`,
											}}
										>
											<motion.div
												className="motion-tooltip relative z-50 flex w-max max-w-none! flex-col items-center justify-center whitespace-nowrap rounded-md bg-black px-4 py-2 text-xs shadow-xl"
												style={{
													rotate,
													...(active.placement === "center"
														? { translateX }
														: {}),
												}}
											>
												<div className="absolute inset-x-10 -bottom-px z-30 h-px w-[20%] bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
												<div className="absolute -bottom-px left-10 z-30 h-px w-[40%] bg-gradient-to-r from-transparent via-sky-500 to-transparent" />
												<div className="relative z-30 text-base font-bold text-white">
													{active.item.name}
												</div>
												<div className="text-xs text-white">
													{active.item.designation}
												</div>
											</motion.div>
										</div>
									</motion.div>
								);
							})()}
					</AnimatePresence>,
					document.body,
				)}
		</>
	);
};
