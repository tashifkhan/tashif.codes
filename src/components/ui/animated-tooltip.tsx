"use client";

import React, { useState } from "react";
import { trigger } from "@/lib/haptics";
import { motion, AnimatePresence } from "motion/react";

export const AnimatedTooltip = ({
	items,
}: {
	items: {
		id: number;
		name: string;
		designation: string;
		image: string;
		url?: string;
	}[];
}) => {
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

	return (
		<>
			{items.map((item, idx) => {
				const isFirst = idx === 0;
				const isLast = idx === items.length - 1;
				const tooltipPosition = isFirst
					? "left-0"
					: isLast
						? "right-0"
						: "left-1/2 -translate-x-1/2";

				return (
					<a
						href={item.url}
						target="_blank"
						rel="noopener noreferrer"
						className="group relative -mr-2 last:mr-0 block cursor-pointer"
						key={item.name}
						onClick={() => trigger("light")}
						onMouseEnter={() => setHoveredIndex(item.id)}
						onMouseLeave={() => setHoveredIndex(null)}
					>
						<AnimatePresence>
							{hoveredIndex === item.id && (
								<motion.div
									initial={{ opacity: 0, y: 8, scale: 0.9 }}
									animate={{
										opacity: 1,
										y: 0,
										scale: 1,
										transition: {
											type: "spring",
											stiffness: 260,
											damping: 18,
										},
									}}
									exit={{ opacity: 0, y: 6, scale: 0.95 }}
									className={`motion-tooltip absolute -top-9 z-50 flex items-center gap-1.5 whitespace-nowrap rounded-full bg-black px-3 py-1.5 text-[11px] leading-none text-white shadow-xl ${tooltipPosition}`}
								>
									<span className="font-medium">{item.name}</span>
									<span className="text-white/40" aria-hidden="true">
										·
									</span>
									<span className="text-white/60">{item.designation}</span>
								</motion.div>
							)}
						</AnimatePresence>
						<img
							height={100}
							width={100}
							src={item.image}
							alt={item.name}
							className="relative !m-0 h-10 w-10 rounded-full border-2 border-white dark:border-gray-900 object-cover object-top !p-0 transition duration-500 group-hover:z-30 group-hover:scale-105"
						/>
					</a>
				);
			})}
		</>
	);
};
