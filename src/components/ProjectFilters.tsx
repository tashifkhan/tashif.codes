import { useState, useEffect } from "react";
import { Search, ExternalLink, ListFilter } from "lucide-react";
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { StarList } from "../data/starLists";
import { useWebHaptics } from "web-haptics/react";

interface StarListOption {
	key: string; // identifier
	label: string; // display label
	repos?: string[]; // owner/repo slugs
}

interface ProjectFiltersProps {
	starLists: StarList[];
}

export default function ProjectFilters({ starLists }: ProjectFiltersProps) {
	const [searchTerm, setSearchTerm] = useState("");
	const [showLiveOnly, setShowLiveOnly] = useState(false);
	const [selectedList, setSelectedList] = useState<string>("all-projects");
	const [lists, setLists] = useState<StarListOption[]>([]);
	const { trigger } = useWebHaptics();

	// Initialize from pre-fetched build-time starLists module
	useEffect(() => {
		const mapped: StarListOption[] = [
			{ key: "all-projects", label: "All Projects" },
			...starLists.map((l) => ({
				key: l.name,
				label: l.name,
				repos: (l.repositories || []).map((r) => r.split("/").pop() || r),
			})),
		];
		setLists(mapped);
		// Expose globally for existing filter handler referencing window.__STAR_LISTS__
		// @ts-ignore
		window.__STAR_LISTS__ = starLists;
	}, []);

	// External star list selection (triggered from GitHub contribution section)
	useEffect(() => {
		function applyList(listName: string) {
			if (!listName) return;
			if (!lists.some((l) => l.key === listName)) return; // ensure exists
			setSelectedList(listName);
			const searchEvent = new CustomEvent("project-search", {
				detail: { term: searchTerm, showLiveOnly, list: listName },
			});
			document.dispatchEvent(searchEvent);
		}
		function handleIncoming(e: Event) {
			const name = (e as CustomEvent).detail?.list as string | undefined;
			if (name) applyList(name);
		}
		document.addEventListener("project-list-select", handleIncoming);
		// Pending selection from navigation (set before component mounted)
		const pending = localStorage.getItem("pending_star_list_select");
		if (pending) {
			applyList(pending);
			localStorage.removeItem("pending_star_list_select");
		}
		return () =>
			document.removeEventListener("project-list-select", handleIncoming);
	}, [lists.length]);

	// Dispatch initial filter state when component mounts
	useEffect(() => {
		// Small delay to ensure component is fully hydrated
		const timer = setTimeout(() => {
			const searchEvent = new CustomEvent("project-search", {
				detail: { term: searchTerm, showLiveOnly, list: selectedList },
			});
			document.dispatchEvent(searchEvent);
		}, 100);

		return () => clearTimeout(timer);
	}, []); // run once

	const handleSearch = (value: string) => {
		trigger("light");
		setSearchTerm(value);

		// Dispatch custom event with current state
		const searchEvent = new CustomEvent("project-search", {
			detail: { term: value, showLiveOnly, list: selectedList },
		});
		document.dispatchEvent(searchEvent);
	};

	const handleLiveFilter = () => {
		trigger("light");
		const newShowLiveOnly = !showLiveOnly;
		setShowLiveOnly(newShowLiveOnly);

		// Dispatch custom event with both search term and live filter
		const searchEvent = new CustomEvent("project-search", {
			detail: {
				term: searchTerm,
				showLiveOnly: newShowLiveOnly,
				list: selectedList,
			},
		});
		document.dispatchEvent(searchEvent);
	};

	const handleListChange = (value: string) => {
		trigger("selection");
		setSelectedList(value);
		const searchEvent = new CustomEvent("project-search", {
			detail: { term: searchTerm, showLiveOnly, list: value },
		});
		document.dispatchEvent(searchEvent);
	};

	return (
		<div className="mb-8">
			<div className="flex flex-col md:flex-row gap-2">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						type="text"
						placeholder="Search projects..."
						value={searchTerm}
						onChange={(e) => handleSearch(e.target.value)}
						className="pl-9 bg-background/50 backdrop-blur-sm"
					/>
				</div>

				<div className="flex flex-row gap-2 w-full md:w-auto">
					{/* Star list selector */}
					<div className="relative flex-1">
						<Select value={selectedList} onValueChange={handleListChange}>
							<SelectTrigger
								data-project-list-select
								className="w-full bg-background/50 backdrop-blur-sm"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{lists.map((l) => (
									<SelectItem key={l.key} value={l.key}>
										{l.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<Button
						variant={showLiveOnly ? "default" : "outline"}
						onClick={handleLiveFilter}
						className={`gap-2 whitespace-nowrap ${
							!showLiveOnly ? "bg-background/50 backdrop-blur-sm" : ""
						}`}
					>
						<ExternalLink size={14} />
						<span>Live Only</span>
					</Button>
				</div>
			</div>
		</div>
	);
}
