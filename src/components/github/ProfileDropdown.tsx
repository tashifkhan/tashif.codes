import { trigger } from "@/lib/haptics";
import React from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { ChevronDown, ExternalLink, Github } from "lucide-react";
import { githubProfiles } from "../../data/profile";

interface ProfileDropdownProps {
	isMobile?: boolean;
}


export default function ProfileDropdown({ isMobile }: ProfileDropdownProps) {
	return (
		<DropdownMenu onOpenChange={() => trigger("light")}>
			<DropdownMenuTrigger
				data-haptic="manual"
				aria-label="GitHub profiles"
				className={
					isMobile
						? "inline-flex items-center justify-center h-9 w-9 rounded-full text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
						: "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-border/60 text-[13px] font-medium bg-card/70 text-foreground/90 hover:border-primary/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
				}
			>
				<Github className="w-3.5 h-3.5 shrink-0" />
				<span className={isMobile ? "sr-only" : undefined}>Profiles</span>
				{!isMobile && <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />}
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
