import { useState, useEffect } from "react";
import { Search, ExternalLink, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { trigger } from "@/lib/haptics";

/**
 * Search box plus the Live and Releases toggles. Grouping by star list moved
 * into the sections of ProjectGrid, so there is no list picker here.
 */
export default function ProjectFilters() {
	const [searchTerm, setSearchTerm] = useState("");
	const [showLiveOnly, setShowLiveOnly] = useState(false);
	const [showReleasesOnly, setShowReleasesOnly] = useState(false);

	const emit = (term: string, live: boolean, releases: boolean) =>
		document.dispatchEvent(
			new CustomEvent("project-search", {
				detail: { term, showLiveOnly: live, showReleasesOnly: releases },
			})
		);

	// Dispatch the initial filter state once the island has hydrated.
	useEffect(() => {
		const timer = setTimeout(() => emit(searchTerm, showLiveOnly, showReleasesOnly), 100);
		return () => clearTimeout(timer);
	}, []); // run once

	const handleSearch = (value: string) => {
		setSearchTerm(value);
		emit(value, showLiveOnly, showReleasesOnly);
	};

	const handleLiveFilter = () => {
		trigger("selection");
		const next = !showLiveOnly;
		setShowLiveOnly(next);
		emit(searchTerm, next, showReleasesOnly);
	};

	const handleReleasesFilter = () => {
		trigger("selection");
		const next = !showReleasesOnly;
		setShowReleasesOnly(next);
		emit(searchTerm, showLiveOnly, next);
	};

	return (
		<div className="mb-8">
			<div className="flex flex-col md:flex-row gap-2">
				<div className="relative flex-1">
					<Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						type="text"
						placeholder="Search projects..."
						value={searchTerm}
						onChange={(e) => handleSearch(e.target.value)}
						className="pl-9 bg-background/50 backdrop-blur-sm"
					/>
				</div>

				<div className="flex flex-wrap gap-2 w-full md:flex-nowrap md:w-auto">
					<Button
						variant={showLiveOnly ? "default" : "outline"}
						onClick={handleLiveFilter}
						aria-pressed={showLiveOnly}
						className={`flex-1 md:flex-none gap-2 whitespace-nowrap ${
							!showLiveOnly ? "bg-background/50 backdrop-blur-sm" : ""
						}`}
					>
						<ExternalLink size={14} />
						<span>Live Only</span>
					</Button>
					<Button
						variant={showReleasesOnly ? "default" : "outline"}
						onClick={handleReleasesFilter}
						aria-pressed={showReleasesOnly}
						className={`flex-1 md:flex-none gap-2 whitespace-nowrap ${
							!showReleasesOnly ? "bg-background/50 backdrop-blur-sm" : ""
						}`}
					>
						<Tag size={14} />
						<span>Releases</span>
					</Button>
				</div>
			</div>
		</div>
	);
}
