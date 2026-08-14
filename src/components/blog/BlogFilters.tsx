import { useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useWebHaptics } from "web-haptics/react";

interface Props {
	categories: string[];
}

export default function BlogFilters({ categories }: Props) {
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedCategories, setSelectedCategories] = useState<string[]>([
		"all",
	]);
	const { trigger } = useWebHaptics();

	const handleSearch = (value: string) => {
		trigger("light");
		setSearchTerm(value);
		const searchEvent = new CustomEvent("blog-search", {
			detail: { term: value },
		});
		document.dispatchEvent(searchEvent);
	};

	const handleCategoryChange = (category: string) => {
		trigger("selection");
		let newCategories: string[];

		if (category === "all") {
			newCategories = ["all"];
		} else {
			// If "all" was selected, remove it
			const current = selectedCategories.filter((c) => c !== "all");

			if (current.includes(category)) {
				newCategories = current.filter((c) => c !== category);
			} else {
				newCategories = [...current, category];
			}

			// If no categories left, revert to "all"
			if (newCategories.length === 0) {
				newCategories = ["all"];
			}
		}

		setSelectedCategories(newCategories);
		const categoryEvent = new CustomEvent("blog-category", {
			detail: { categories: newCategories },
		});
		document.dispatchEvent(categoryEvent);
	};

	return (
		<div className="mb-8 space-y-6">
			<div className="relative max-w-xl">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
				<Input
					type="text"
					placeholder="Search posts..."
					value={searchTerm}
					onChange={(e) => handleSearch(e.target.value)}
					className="pl-9 bg-background/50 backdrop-blur-sm"
				/>
			</div>
			<div className="flex flex-wrap gap-2">
				<Badge
					variant={selectedCategories.includes("all") ? "default" : "outline"}
					className={cn(
						"cursor-pointer px-4 py-1.5 text-sm transition-all hover:scale-105",
						!selectedCategories.includes("all") && "hover:bg-muted"
					)}
					onClick={() => handleCategoryChange("all")}
				>
					All
				</Badge>
				{categories.map((category) => (
					<Badge
						key={category}
						variant={
							selectedCategories.includes(category) ? "default" : "outline"
						}
						className={cn(
							"cursor-pointer px-4 py-1.5 text-sm transition-all hover:scale-105",
							!selectedCategories.includes(category) && "hover:bg-muted"
						)}
						onClick={() => handleCategoryChange(category)}
					>
						{category}
					</Badge>
				))}
			</div>
		</div>
	);
}
