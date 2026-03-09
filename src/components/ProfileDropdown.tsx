import React from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ExternalLink } from "lucide-react";

interface ProfileDropdownProps {
	isMobile?: boolean;
}

export default function ProfileDropdown({ isMobile }: ProfileDropdownProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				className={
					isMobile
						? "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors focus:outline-none"
						: "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors focus:outline-none"
				}
			>
				{isMobile ? (
					<>
						<ExternalLink className="w-3 h-3" />
						Profiles
					</>
				) : (
					<>
						External Profile <ExternalLink size={12} />
					</>
				)}
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-48 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md"
			>
				<DropdownMenuItem
					asChild
					className="cursor-pointer font-medium hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gray-100 dark:focus:bg-gray-800"
				>
					<a
						href="https://github.com/tashifkhan"
						target="_blank"
						rel="noopener noreferrer"
						data-haptic-external="true"
						className="w-full flex items-center justify-between"
					>
						tashifkhan
						<ExternalLink size={14} className="opacity-50" />
					</a>
				</DropdownMenuItem>
				<DropdownMenuItem
					asChild
					className="cursor-pointer font-medium hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gray-100 dark:focus:bg-gray-800"
				>
					<a
						href="https://github.com/tashifkhansitg"
						target="_blank"
						rel="noopener noreferrer"
						data-haptic-external="true"
						className="w-full flex items-center justify-between"
					>
						tashifkhansitg
						<ExternalLink size={14} className="opacity-50" />
					</a>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
