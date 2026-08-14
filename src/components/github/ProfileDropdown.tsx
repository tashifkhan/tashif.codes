import React from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { ExternalLink, Github } from "lucide-react";
import { githubProfiles } from "../../data/profile";

interface ProfileDropdownProps {
	isMobile?: boolean;
}


export default function ProfileDropdown({ isMobile }: ProfileDropdownProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				data-haptic=""
				aria-label="External GitHub profiles"
				className={
					isMobile
						? "inline-flex items-center justify-center h-7 w-7 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors focus:outline-none shrink-0"
						: "inline-flex items-center justify-center sm:justify-start gap-0 sm:gap-1.5 h-7 w-7 sm:w-auto sm:px-2.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors focus:outline-none shrink-0"
				}
			>
				{/* Icon-only on mobile; label from sm up */}
				<ExternalLink className="w-3.5 h-3.5 sm:w-3 sm:h-3 shrink-0" />
				<span className="hidden sm:inline">External Profile</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-52 bg-card/95 dark:bg-card/95 backdrop-blur-md"
			>
				<DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-muted-foreground font-normal py-1.5">
					<Github size={12} /> GitHub
				</DropdownMenuLabel>
				{githubProfiles.map(({ handle, url }) => (
					<DropdownMenuItem
						key={handle}
						asChild
						className="cursor-pointer font-medium hover:bg-muted dark:hover:bg-secondary focus:bg-muted dark:focus:bg-secondary"
					>
						<a
							href={url}
							target="_blank"
							rel="noopener noreferrer"
							data-haptic-external="true"
							className="w-full flex items-center justify-between"
						>
							{handle}
							<ExternalLink size={14} className="opacity-50" />
						</a>
					</DropdownMenuItem>
				))}

				</DropdownMenuContent>
		</DropdownMenu>
	);
}
