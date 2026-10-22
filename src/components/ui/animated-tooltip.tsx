"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { trigger } from "@/lib/haptics";
import { motion } from "motion/react";

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
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!active) return;

		const dismiss = () => setActive(null);
		window.addEventListener("scroll", dismiss, { passive: true });
		window.addEventListener("resize", dismiss);

		return () => {
			window.removeEventListener("scroll", dismiss);
			window.removeEventListener("resize", dismiss);
		};
	}, [active]);

	const show = (item: TooltipItem, index: number, element: HTMLElement) => {
		const rect = element.getBoundingClientRect();
		const placement: ActiveTooltip["placement"] =
			index === 0 ? "left" : index === items.length - 1 ? "right" : "center";

		setActive({ item, rect, placement });
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
					onMouseEnter={(event) => show(item, idx, event.currentTarget)}
					onMouseLeave={() => setActive(null)}
					onFocus={(event) => show(item, idx, event.currentTarget)}
					onBlur={() => setActive(null)}
					aria-label={`${item.name}, ${item.designation}`}
				>
					<img
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
					<div
						style={{
							position: "fixed",
							top:
								active.rect.top < 80
									? active.rect.bottom + 10
									: active.rect.top - 10,
							left:
								active.placement === "left"
									? active.rect.left
									: active.placement === "right"
										? active.rect.right
										: active.rect.left + active.rect.width / 2,
							transform:
								active.placement === "left"
									? `translate(0, ${active.rect.top < 80 ? 0 : -100}%)`
									: active.placement === "right"
										? `translate(-100%, ${active.rect.top < 80 ? 0 : -100}%)`
										: `translate(-50%, ${active.rect.top < 80 ? 0 : -100}%)`,
							zIndex: 9999,
							pointerEvents: "none",
						}}
					>
						<motion.div
							initial={{ opacity: 0, y: 8, scale: 0.92 }}
							animate={{
								opacity: 1,
								y: 0,
								scale: 1,
								transition: { type: "spring", stiffness: 260, damping: 18 },
							}}
							className="motion-tooltip flex w-max max-w-none! items-center gap-1.5 whitespace-nowrap rounded-full bg-black px-3 py-1.5 text-[11px] leading-none text-white shadow-xl"
							role="tooltip"
						>
							<span className="font-medium">{active.item.name}</span>
							<span className="text-white/40" aria-hidden="true">
								·
							</span>
							<span className="text-white/60">{active.item.designation}</span>
						</motion.div>
					</div>,
					document.body,
				)}
		</>
	);
};
