import React from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ExternalLink, Github } from "lucide-react";
import { githubProfiles } from "../data/profile";

interface ProfileDropdownProps {
	isMobile?: boolean;
}


export default function ProfileDropdown({ isMobile }: ProfileDropdownProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				data-haptic=""
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
