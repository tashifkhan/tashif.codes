import React, { useState, useEffect } from "react";
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from "./ui/select";
import { useWebHaptics } from "web-haptics/react";

interface Props {
	availableYears: number[];
	defaultValue: string;
}

export default function YearSelect({ availableYears, defaultValue }: Props) {
	const [value, setValue] = useState<string>(defaultValue);
	const { trigger } = useWebHaptics();

	useEffect(() => {
		// Ensure hidden native select reflects initial value
		const hidden = document.getElementById(
			"year-selector"
		) as HTMLSelectElement | null;
		if (hidden) {
			hidden.value = value;
		}
	}, []);

	const handleChange = (v: string) => {
		trigger("selection");
		setValue(v);
		// Keep the hidden native select in sync for existing scripts
		const hidden = document.getElementById(
			"year-selector"
		) as HTMLSelectElement | null;
		if (hidden) {
			hidden.value = v;
			// Dispatch change event so listeners react to the update
			hidden.dispatchEvent(new Event("change", { bubbles: true }));
		}
	};

	return (
		<div>
			<Select value={value} onValueChange={handleChange}>
				<SelectTrigger
					id="year-select-trigger"
					className="text-xs sm:text-sm font-medium"
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="last-year">Last 365 days</SelectItem>
					{availableYears.map((y) => (
						<SelectItem key={y} value={String(y)}>
							{String(y)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			{/* Hidden native select kept for legacy scripts that expect #year-selector */}
			<select id="year-selector" aria-hidden style={{ display: "none" }}>
				<option value="last-year">Last 365 days</option>
				{availableYears.map((y) => (
					<option key={y} value={String(y)}>
						{String(y)}
					</option>
				))}
			</select>
		</div>
	);
}
