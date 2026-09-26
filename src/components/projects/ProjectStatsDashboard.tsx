import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Users,
	Eye,
	Activity,
	Calendar,
	Smartphone,
	Globe,
	Monitor,
	X,
	Loader2,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { formatFetchedAt } from "@/lib/dataFreshness";
import { useProjectStats } from "@/hooks/useProjectStats";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { areaY, barX, defineChart, lineY } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { pie, polar, radialArc } from "@tanstack/charts/polar";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import { tooltip } from "@tanstack/charts/tooltip";
import { trigger } from "@/lib/haptics";

// Theme tokens shared by every TanStack chart on this page
const CHART_THEME = {
	foreground: "var(--color-muted-foreground)",
	muted: "var(--color-muted-foreground)",
	grid: "var(--color-border)",
	background: "transparent",
} as const;

// --- Types ---

type TimeseriesEntry = {
	date: string;
	pageviews: number;
	visitors: number;
	bounce_rate: number;
	migration_date?: string | null;
};

type StatEntry = {
	key: string;
	pageviews: number;
	visitors: number;
	migration_date?: string | null;
};

type StatsBreakdown = {
	path: StatEntry[];
	device_type: StatEntry[];
	referrer: StatEntry[];
	os_name: StatEntry[];
	country: StatEntry[];
};

type AllStats = {
	metadata: { export_date: string; source: string; excludes_history?: boolean; history_field?: FilterField | null };
	timeseries: TimeseriesEntry[];
	stats: StatsBreakdown;
};

type FilterField = keyof StatsBreakdown;
type StatsFilter = { field: FilterField; value: string };
type SelectFilter = (field: FilterField, value: string) => void;

const FILTER_LABELS: Record<FilterField, string> = {
	path: "Path",
	referrer: "Referrer",
	country: "Country",
	device_type: "Device",
	os_name: "OS",
};

function readUrlFilters(): StatsFilter[] {
	if (typeof window === "undefined") return [];
	return new URLSearchParams(window.location.search).getAll("filter").flatMap((raw) => {
		const split = raw.indexOf(":");
		const field = raw.slice(0, split) as FilterField;
		const value = raw.slice(split + 1);
		return split > 0 && value && field in FILTER_LABELS ? [{ field, value }] : [];
	});
}

type ProjectInfo = {
	slug: string;
	name: string;
};

type ProjectListResponse = {
	projects: ProjectInfo[];
	total: number;
};

type Granularity = "day" | "week" | "month" | "year";

// --- Constants ---

const GRANULARITY_LABELS: Record<Granularity, string> = {
	day: "Daily",
	week: "Weekly",
	month: "Monthly",
	year: "Yearly",
};

const COLORS = [
	"var(--color-chart-1)",
	"var(--color-chart-2)",
	"var(--color-chart-3)",
	"var(--color-chart-4)",
	"var(--color-chart-5)",
];

// Base card class — flat dark surface with hairline border
const CARD = "rounded-xl border border-border bg-card transition-colors hover:border-accent";

// Compact terminal-prompt empty state for chart areas, matching the
// site's `➜ tashif.codes %` aesthetic.
const ChartEmpty = memo(({ label = "no data" }: { label?: string }) => (
	<div className="flex h-full w-full items-center justify-center py-8">
		<div className="flex items-baseline gap-1.5 font-mono text-xs">
			<span className="select-none font-bold text-primary" aria-hidden="true">
				➜
			</span>
			<span className="font-semibold text-muted-foreground">tashif.codes</span>
			<span className="select-none text-muted-foreground/60" aria-hidden="true">
				%
			</span>
			<span className="text-muted-foreground/80">{label}</span>
		</div>
	</div>
));

// --- Chart Components (TanStack Charts) ---

type AreaSeriesRow = {
	date: string;
	formattedDate: string;
	displayValue: number;
	pageviews: number;
	visitors: number;
	bounce_rate: number;
};

const metricLabel = (key: string) =>
	key.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());

// Tooltip heading for one chart point, e.g. "Week of Sep 21, 2026".
function periodLabel(date: string, granularity: Granularity): string {
	const d = new Date(date);
	if (isNaN(d.getTime())) return String(date).split("T")[0];
	const format = (options: Intl.DateTimeFormatOptions) => d.toLocaleDateString(undefined, { ...options, timeZone: "UTC" });
	if (granularity === "year") return format({ year: "numeric" });
	if (granularity === "month") return format({ month: "long", year: "numeric" });
	const day = format({ month: "short", day: "numeric", year: "numeric" });
	return granularity === "week" ? `Week of ${day}` : `${format({ weekday: "short" })}, ${day}`;
}

const formatShare = (part: number, total: number) =>
	total > 0 ? `${((part / total) * 100).toFixed(part / total < 0.1 ? 1 : 0)}%` : "—";

// Signed change from the previous point, e.g. "+12%" or "−3.4 pts".
function formatChange(current: number, previous: number | undefined, points = false): string | null {
	if (previous === undefined) return null;
	if (points) {
		const diff = current - previous;
		return `${diff >= 0 ? "+" : "−"}${Math.abs(diff).toFixed(1)} pts`;
	}
	if (previous === 0) return current > 0 ? "new" : null;
	const pct = ((current - previous) / previous) * 100;
	return `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0)}%`;
}

const TimeseriesAreaChart = memo(({
	data,
	dataKey,
	color,
	height = 300,
	unit = "",
	granularity = "day",
}: {
	data: TimeseriesEntry[];
	dataKey: "pageviews" | "visitors" | "bounce_rate";
	color: string;
	height?: number;
	unit?: string;
	granularity?: Granularity;
}) => {
	const series = useMemo((): AreaSeriesRow[] => {
		if (!data || data.length === 0) return [];

		const labelOptions: Intl.DateTimeFormatOptions =
			granularity === "year"
				? { year: "numeric", timeZone: "UTC" }
				: granularity === "month"
				? { month: "short", year: "numeric", timeZone: "UTC" }
				: { month: "short", day: "numeric", timeZone: "UTC" };

		return data.map((d) => {
			const parsedDate = new Date(d.date);
			const safeDate = isNaN(parsedDate.getTime())
				? String(d.date).split("T")[0]
				: parsedDate.toLocaleDateString(undefined, labelOptions);

			return {
				date: d.date,
				formattedDate: safeDate,
				pageviews: d.pageviews,
				visitors: d.visitors,
				bounce_rate: d.bounce_rate,
				displayValue:
					dataKey === "bounce_rate"
						? Math.round(d[dataKey] * 100) / 100
						: d[dataKey],
			};
		});
	}, [data, dataKey, granularity]);

	const indexByDate = useMemo(() => new Map(series.map((row, i) => [row.date, i])), [series]);
	const gradientId = `area-fill-${dataKey}`;
	const seriesLabel = metricLabel(dataKey);

	const definition = useMemo(() => {
		if (series.length === 0) return null;

		return defineChart({
			marks: [
				areaY(series, {
					id: `${dataKey}-area`,
					x: "formattedDate",
					y1: 0,
					y2: "displayValue",
					fill: `url(#${gradientId})`,
					fillOpacity: 1,
					key: "date",
				}),
				lineY(series, {
					id: `${dataKey}-line`,
					x: "formattedDate",
					y: "displayValue",
					stroke: color,
					strokeWidth: 1.5,
					key: "date",
				}),
			],
			x: {
				scale: () => scalePoint<string>().padding(0.05),
				grid: false,
				axis: {
					line: false,
					ticks: { size: 0, spacing: 72 },
					tickLabels: {
						fontSize: 11,
						thin: { minGap: 20, priority: "ends" },
					},
				},
			},
			y: {
				scale: scaleLinear,
				nice: true,
				grid: true,
				axis: {
					line: false,
					ticks: {
						size: 0,
						count: 5,
						format: (value) => `${Number(value).toLocaleString()}${unit}`,
					},
					tickLabels: { fontSize: 11 },
				},
			},
			gradients: [
				{
					id: gradientId,
					x1: 0,
					y1: 1,
					x2: 0,
					y2: 0,
					stops: [
						{ offset: 0, color, opacity: 0 },
						{ offset: 1, color, opacity: 0.18 },
					],
				},
			],
			theme: CHART_THEME,
			focus: "nearest-x",
			tooltip: {
				use: tooltip,
				className: "stats-chart-tooltip",
				content: (points) => {
					const row = points[0]?.datum as AreaSeriesRow | undefined;
					if (!row) return { rows: [] };
					const index = indexByDate.get(row.date) ?? -1;
					const previous = index > 0 ? series[index - 1] : undefined;
					const metric = (key: typeof dataKey, label: string, value: string) => ({
						label,
						value,
						color: key === dataKey ? color : undefined,
					});
					const rows = [
						metric("pageviews", "Pageviews", row.pageviews.toLocaleString()),
						metric("visitors", "Visitors", row.visitors.toLocaleString()),
					];
					if (row.bounce_rate > 0) rows.push(metric("bounce_rate", "Bounce rate", `${row.bounce_rate.toFixed(1)}%`));
					const change = previous && formatChange(
						dataKey === "bounce_rate" ? row.bounce_rate : row[dataKey],
						dataKey === "bounce_rate" ? previous.bounce_rate : previous[dataKey],
						dataKey === "bounce_rate",
					);
					if (change) rows.push({ label: `vs previous ${granularity}`, value: change, color: undefined });
					return { title: periodLabel(row.date, granularity), rows };
				},
			},
		});
	}, [series, indexByDate, dataKey, color, unit, gradientId, granularity]);

	if (!definition) {
		return (
			<div style={{ height }}>
				<ChartEmpty label="no data available" />
			</div>
		);
	}

	return (
		<div className="w-full" style={{ height }}>
			<Chart
				definition={definition}
				height={height}
				ariaLabel={`${seriesLabel} over time`}
				className="w-full stats-tanstack-chart"
				style={{ color: "var(--color-muted-foreground)" }}
			/>
		</div>
	);
});
TimeseriesAreaChart.displayName = "TimeseriesAreaChart";

const DonutChart = memo(({
	data,
	title,
	height = 300,
	active,
	onSelect,
}: {
	data: StatEntry[];
	title: string;
	height?: number;
	active?: string;
	onSelect?: (key: string) => void;
}) => {
	const chartData = useMemo(
		() =>
			data.slice(0, 5).map((item) => ({
				name: item.key,
				value: item.pageviews,
				visitors: item.visitors,
			})),
		[data],
	);
	const total = useMemo(() => data.reduce((sum, item) => sum + item.pageviews, 0), [data]);

	const chartHeight = useMemo(() => {
		const legendRows = Math.max(1, Math.ceil(chartData.length / 3));
		const legendHeight = legendRows * 28;
		return Math.max(170, height - legendHeight - 16);
	}, [chartData.length, height]);

	const definition = useMemo(() => {
		if (chartData.length === 0) return null;

		const names = chartData.map((row) => row.name);
		const slices = pie(chartData, {
			value: "value",
			gapAngle: 0.05,
		});

		return defineChart({
			marks: [
				polar({
					inset: 8,
					radiusRatio: 0.9,
					marks: [
						radialArc(slices, {
							innerRadius: ({ radius }) => radius * 0.68,
							cornerRadius: 3,
							color: "name",
							key: "name",
							stroke: "transparent",
						}),
					],
				}),
			],
			guides: false,
			color: {
				domain: names,
				range: COLORS.slice(0, names.length),
			},
			theme: CHART_THEME,
			tooltip: {
				use: tooltip,
				className: "stats-chart-tooltip",
				content: (points) => {
					const row = points[0]?.datum as (typeof chartData)[number] | undefined;
					if (!row) return { rows: [] };
					const rows = [
						{ label: "Pageviews", value: row.value.toLocaleString() },
						{ label: "Visitors", value: row.visitors.toLocaleString() },
						{ label: "Share", value: formatShare(row.value, total) },
					];
					if (onSelect) rows.push({ label: active === row.name ? "Click to clear filter" : "Click to filter", value: "" });
					return { title: row.name, color: COLORS[names.indexOf(row.name) % COLORS.length], rows };
				},
			},
		});
	}, [chartData, total, active, onSelect]);

	if (chartData.length === 0 || !definition) {
		return <ChartEmpty />;
	}

	return (
		<div className="w-full h-full flex flex-col justify-center">
			<div style={{ width: "100%", height: chartHeight }}>
				<Chart
					definition={definition}
					height={chartHeight}
					ariaLabel={title}
					className={cn("w-full stats-tanstack-chart", onSelect && "cursor-pointer")}
					style={{ color: "var(--color-muted-foreground)" }}
					onSelect={(point) => {
						const name = (point?.datum as { name?: string } | undefined)?.name;
						if (name) onSelect?.(name);
					}}
				/>
			</div>

			<div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2">
				{chartData.map((entry, index) => (
					<button
						type="button"
						key={`${title}-${entry.name}`}
						onClick={() => onSelect?.(entry.name)}
						aria-pressed={active === entry.name}
						title={`${entry.name}: ${entry.value.toLocaleString()} pageviews. Click to ${active === entry.name ? "clear the filter" : "filter"}.`}
						className="inline-flex items-center gap-1.5 rounded px-1 -mx-1 hover:bg-muted/50 transition-colors"
					>
						<span
							className="h-2 w-2 rounded-sm shrink-0"
							style={{ backgroundColor: COLORS[index % COLORS.length] }}
						/>
						<span className={cn("text-[11px] font-medium", active === entry.name ? "text-primary" : "text-muted-foreground")}>{entry.name}</span>
						<span className="text-[10px] font-mono tabular-nums text-muted-foreground/70">{formatShare(entry.value, total)}</span>
					</button>
				))}
			</div>
		</div>
	);
});
DonutChart.displayName = "DonutChart";

const HorizontalBarChart = memo(({
	data,
	height = 300,
}: {
	data: StatEntry[];
	height?: number;
}) => {
	const chartData = useMemo(
		() =>
			data.slice(0, 8).map((item) => ({
				name: item.key,
				value: item.pageviews,
			})),
		[data],
	);

	const definition = useMemo(() => {
		if (chartData.length === 0) return null;

		const names = chartData.map((row) => row.name);

		return defineChart({
			marks: [
				barX(chartData, {
					y: "name",
					x: "value",
					color: "name",
					key: "name",
					radius: 3,
					inset: 2,
				}),
			],
			x: {
				scale: scaleLinear,
				nice: true,
				grid: true,
				axis: false,
			},
			y: {
				scale: () =>
					scaleBand<string>()
						.domain(names)
						.padding(0.18),
				grid: false,
				axis: {
					line: false,
					ticks: { size: 0 },
					tickLabels: { fontSize: 11 },
				},
			},
			color: {
				domain: names,
				range: COLORS.slice(0, names.length),
			},
			theme: CHART_THEME,
			tooltip: {
				use: tooltip,
				className: "stats-chart-tooltip",
				items: [
					{ field: "name", label: "Category" },
					{
						channel: "x",
						label: "Pageviews",
						text: (point) => Number(point.xValue).toLocaleString(),
					},
				],
			},
		});
	}, [chartData]);

	if (chartData.length === 0 || !definition) {
		return <ChartEmpty />;
	}

	return (
		<div className="w-full" style={{ height }}>
			<Chart
				definition={definition}
				height={height}
				ariaLabel="Pageviews by category"
				className="w-full stats-tanstack-chart"
				style={{ color: "var(--color-muted-foreground)" }}
			/>
		</div>
	);
});
HorizontalBarChart.displayName = "HorizontalBarChart";

// --- Sparkline — lightweight inline SVG, no chart lib overhead ---
const Sparkline = memo(({ data, color }: { data: number[]; color: string }) => {
	const path = useMemo(() => {
		if (data.length < 2) return null;
		const w = 120;
		const h = 36;
		const min = Math.min(...data);
		const range = Math.max(...data) - min || 1;
		const pts = data.map((v, i) => [
			(i / (data.length - 1)) * w,
			h - 3 - ((v - min) / range) * (h - 6),
		]);
		const line = pts
			.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
			.join(" ");
		return { line, area: `${line} L${w},${h} L0,${h} Z` };
	}, [data]);

	if (!path) return null;

	return (
		<svg
			viewBox="0 0 120 36"
			preserveAspectRatio="none"
			aria-hidden="true"
			className="pointer-events-none absolute bottom-0 right-0 h-10 w-[55%]"
		>
			<path d={path.area} fill={color} opacity={0.08} />
			<path
				d={path.line}
				fill="none"
				stroke={color}
				strokeWidth={1.5}
				opacity={0.5}
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
});
Sparkline.displayName = "Sparkline";

// --- MetricCard ---
const MetricCard = memo(({
	title,
	value,
	icon: Icon,
	trend,
	accentColor = "var(--color-primary)",
	spark,
}: {
	title: string;
	value: string | number;
	icon: React.ComponentType<{ className?: string }>;
	trend?: string;
	accentColor?: string;
	spark?: number[];
}) => (
	<motion.div
		className={cn(CARD, "relative overflow-hidden p-6 flex flex-col gap-3")}
		initial={{ opacity: 0, y: 10 }}
		animate={{ opacity: 1, y: 0 }}
		transition={{ duration: 0.35 }}
	>
		{/* Accent bar */}
		<div
			className="absolute left-0 top-5 bottom-5 w-[2px] rounded-r-full"
			style={{ backgroundColor: accentColor }}
		/>
		{spark && <Sparkline data={spark} color={accentColor} />}
		<p className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground pl-4 flex items-center gap-2">
			<Icon className="w-3 h-3" />
			{title}
		</p>
		<div className="relative text-[2.6rem] leading-none font-mono font-bold text-foreground pl-4 tracking-tight tabular-nums">
			{value}
		</div>
		{trend && (
			<p className="relative text-[11px] text-muted-foreground pl-4">{trend}</p>
		)}
	</motion.div>
));
MetricCard.displayName = "MetricCard";

// Bucket a daily timeseries into week (Monday start), month, or year buckets.
// Pageviews and visitors are summed; bounce rate is weight-averaged by pageviews.
function aggregateTimeseries(
	data: TimeseriesEntry[],
	granularity: Granularity
): TimeseriesEntry[] {
	if (granularity === "day" || data.length === 0) return data;

	const bucketKey = (dateStr: string): string => {
		const d = new Date(dateStr);
		if (isNaN(d.getTime())) return dateStr;
		if (granularity === "year") return `${d.getUTCFullYear()}-01-01`;
		if (granularity === "month") {
			return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
		}
		const start = new Date(d);
		start.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
		return start.toISOString().slice(0, 10);
	};

	const buckets = new Map<
		string,
		{ pageviews: number; visitors: number; bounceSum: number; bounceWeight: number }
	>();

	for (const entry of data) {
		const key = bucketKey(entry.date);
		let bucket = buckets.get(key);
		if (!bucket) {
			bucket = { pageviews: 0, visitors: 0, bounceSum: 0, bounceWeight: 0 };
			buckets.set(key, bucket);
		}
		bucket.pageviews += entry.pageviews;
		bucket.visitors += entry.visitors;
		if (entry.bounce_rate > 0 && entry.pageviews > 0) {
			bucket.bounceSum += entry.bounce_rate * entry.pageviews;
			bucket.bounceWeight += entry.pageviews;
		}
	}

	return Array.from(buckets.entries()).map(([date, b]) => ({
		date,
		pageviews: b.pageviews,
		visitors: b.visitors,
		bounce_rate: b.bounceWeight > 0 ? b.bounceSum / b.bounceWeight : 0,
	}));
}

// Downsample a series to at most `points` values so sparklines stay light
function downsample(values: number[], points = 40): number[] {
	if (values.length <= points) return values;
	const bucket = values.length / points;
	return Array.from({ length: points }, (_, i) => {
		const start = Math.floor(i * bucket);
		const end = Math.max(start + 1, Math.floor((i + 1) * bucket));
		let sum = 0;
		for (let j = start; j < end; j++) sum += values[j];
		return sum / (end - start);
	});
}

// --- ProgressBar ---
const ProgressBar = memo(({ value, maxVal, index }: { value: number; maxVal: number; index: number }) => (
	<div className="h-[2px] w-full bg-secondary rounded-full overflow-hidden">
		<motion.div
			className="h-full rounded-full"
			style={{ backgroundColor: "var(--color-primary)", opacity: 0.55 }}
			initial={{ width: 0 }}
			animate={{ width: `${(value / maxVal) * 100}%` }}
			transition={{ duration: 0.6, delay: index * 0.04, ease: "easeOut" }}
		/>
	</div>
));
ProgressBar.displayName = "ProgressBar";

// --- BreakdownList ---
type ListTip = { item: StatEntry; rect: DOMRect };

// Rendered into <body> so the scrolling list can't clip it.
const ListTooltip = ({ tip, total, active }: { tip: ListTip; total: number; active: boolean }) => {
	const below = tip.rect.top < 140;
	return createPortal(
		<div
			role="tooltip"
			className="ts-chart-tooltip stats-chart-tooltip pointer-events-none fixed z-50 max-w-[20rem]"
			style={{
				left: Math.min(tip.rect.left + 16, window.innerWidth - 336),
				top: below ? tip.rect.bottom + 6 : tip.rect.top - 6,
				transform: below ? undefined : "translateY(-100%)",
			}}
		>
			<div className="ts-chart-tooltip__title break-all">{tip.item.key}</div>
			<div className="ts-chart-tooltip__rows">
				{[
					["Pageviews", tip.item.pageviews.toLocaleString()],
					["Visitors", tip.item.visitors.toLocaleString()],
					["Share", formatShare(tip.item.pageviews, total)],
				].map(([label, value]) => (
					<div key={label} className="ts-chart-tooltip__row flex justify-between gap-6">
						<span>{label}</span>
						<span className="tabular-nums text-foreground">{value}</span>
					</div>
				))}
				<div className="ts-chart-tooltip__row">{active ? "Click to clear filter" : "Click to filter"}</div>
			</div>
		</div>,
		document.body,
	);
};

const BreakdownList = memo(({
	title,
	items,
	maxVal,
	icon: Icon,
	field,
	active,
	onSelect,
}: {
	title: string;
	items: StatEntry[];
	maxVal: number;
	icon?: React.ComponentType<{ className?: string }>;
	field: FilterField;
	active?: string;
	onSelect: SelectFilter;
}) => {
	const [tip, setTip] = useState<ListTip | null>(null);
	const total = useMemo(() => items.reduce((sum, item) => sum + item.pageviews, 0), [items]);
	useEffect(() => {
		if (!tip) return;
		const hide = () => setTip(null);
		window.addEventListener("scroll", hide, { passive: true });
		return () => window.removeEventListener("scroll", hide);
	}, [tip]);
	useEffect(() => setTip(null), [items]);
	const show = (item: StatEntry) => (event: React.SyntheticEvent<HTMLElement>) =>
		setTip({ item, rect: event.currentTarget.getBoundingClientRect() });

	return (
		<div className={cn(CARD, "max-h-[300px] sm:max-h-[400px] md:h-[400px] flex flex-col")}>
			<div className="px-5 py-3.5 border-b border-border flex items-center gap-2 shrink-0">
				{Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
				<span className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground">
					{title}
				</span>
			</div>
			<div className="flex-1 overflow-auto no-scrollbar" onScroll={() => setTip(null)}>
				{items.length === 0 ? (
					<ChartEmpty label="no data available" />
				) : (
					<div className="divide-y divide-border">
						{items.map((item, i) => (
							<button
								type="button"
								key={item.key}
								onClick={() => onSelect(field, item.key)}
								onMouseEnter={show(item)}
								onFocus={show(item)}
								onMouseLeave={() => setTip(null)}
								onBlur={() => setTip(null)}
								aria-pressed={active === item.key}
								aria-label={`${item.key}, ${item.pageviews.toLocaleString()} pageviews. ${active === item.key ? "Clear" : "Filter by"} ${FILTER_LABELS[field].toLowerCase()}.`}
								className={cn("group block w-full text-left px-5 py-3 hover:bg-muted/50 transition-colors", active === item.key && "bg-muted/50")}
							>
								<div className="flex justify-between items-baseline gap-3 mb-2">
									<span className={cn("text-sm truncate font-medium group-hover:text-primary transition-colors", active === item.key ? "text-primary" : "text-foreground")}>
										{item.key.replace(/^https?:\/\/[^/]+/, "") || "/"}
									</span>
									<span className="text-xs font-mono text-muted-foreground shrink-0 tabular-nums">
										{item.pageviews.toLocaleString()}
									</span>
								</div>
								<ProgressBar value={item.pageviews} maxVal={maxVal} index={i} />
							</button>
						))}
					</div>
				)}
			</div>
			{tip && <ListTooltip tip={tip} total={total} active={active === tip.item.key} />}
		</div>
	);
});
BreakdownList.displayName = "BreakdownList";

// --- BreakdownChartCard ---
const BreakdownChartCard = memo(({
	title,
	children,
	icon: Icon,
}: {
	title: string;
	children: React.ReactNode;
	icon?: React.ComponentType<{ className?: string }>;
}) => (
	<div className={cn(CARD, "h-[400px] flex flex-col")}>
		<div className="px-5 py-3.5 border-b border-border flex items-center gap-2 shrink-0">
			{Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
			<span className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground">
				{title}
			</span>
		</div>
		<div className="flex-1 p-4 flex items-center justify-center overflow-hidden">
			{children}
		</div>
	</div>
));
BreakdownChartCard.displayName = "BreakdownChartCard";

// --- Main Dashboard ---

export default function ProjectStatsDashboard() {
	const [projects, setProjects] = useState<ProjectInfo[]>([]);
	const [selectedSlug, setSelectedSlug] = useState<string>("");
	const [projectsError, setProjectsError] = useState<string | null>(null);
	const [period, setPeriod] = useState<string>("0");
	const [granularity, setGranularity] = useState<Granularity>("week");
	const [retryToken, setRetryToken] = useState<number>(0);
	const [filters, setFilters] = useState<StatsFilter[]>([]);
	useEffect(() => setFilters(readUrlFilters()), []);
	const filterParams = useMemo(() => filters.map((f) => `${f.field}:${f.value}`), [filters]);
	const activeFilter = useMemo(
		() => Object.fromEntries(filters.map((f) => [f.field, f.value])) as Partial<Record<FilterField, string>>,
		[filters],
	);

	// Clicking an entry filters by it; clicking the active entry again clears it.
	const selectFilter = useCallback<SelectFilter>((field, value) => {
		trigger("selection");
		setFilters((current) => {
			const rest = current.filter((f) => f.field !== field);
			return current.some((f) => f.field === field && f.value === value) ? rest : [...rest, { field, value }];
		});
	}, []);
	const API_PREFIX = "/projects/stats/api";

	const API_BASE = useMemo(() => {
		const configured = (import.meta.env.PUBLIC_API_BASE || "").trim().replace(/\/+$/, "");
		if (!configured) return API_PREFIX;
		if (configured.endsWith(API_PREFIX)) return configured;
		return `${configured}${API_PREFIX}`;
	}, []);

	const getInitialProject = useCallback(() => {
		if (typeof window !== "undefined") {
			const params = new URLSearchParams(window.location.search);
			return params.get("project") || "";
		}
		return "";
	}, []);

	const { snapshot, loading, slow, error: statsError, refresh } = useProjectStats<AllStats>(API_BASE, selectedSlug, period, filterParams);
	const stats = snapshot?.data ?? null;
	const error = projectsError || statsError;
	const displayedPeriod = snapshot?.days ?? period;
	// While another project, period or filter loads, the last snapshot stays
	// on screen dimmed, with a label saying what is on its way.
	const pending = !!snapshot && (snapshot.slug !== selectedSlug || snapshot.days !== period || snapshot.filterKey !== filterParams.join("\n"));
	const pendingLabel = snapshot?.slug !== selectedSlug
		? `Loading ${projects.find((p) => p.slug === selectedSlug)?.name ?? "project"}`
		: snapshot?.days !== period
			? `Loading ${period === "0" ? "lifetime" : `last ${period} days`}`
			: filters.length ? "Applying filters" : "Clearing filters";
	const [now, setNow] = useState<number | undefined>();
	useEffect(() => {
		setNow(Date.now());
		const timer = window.setInterval(() => setNow(Date.now()), 30000);
		return () => window.clearInterval(timer);
	}, []);

	// Fetch Projects List
	useEffect(() => {
		const controller = new AbortController();

		async function fetchProjects() {
			setProjectsError(null);
			try {
				const res = await fetch(`${API_BASE}/v1/projects`, {
					signal: controller.signal
				});
				if (!res.ok) {
					throw new Error(`Failed to fetch projects (${res.status})`);
				}
				const data: ProjectListResponse = await res.json();
				setProjects(data.projects);

				const urlProject = getInitialProject();
				if (urlProject && data.projects.some((p) => p.slug === urlProject)) {
					setSelectedSlug(urlProject);
				} else if (data.projects.length > 0) {
					setSelectedSlug(data.projects[0].slug);
				}
			} catch (err) {
				if (err instanceof Error && err.name === 'AbortError') return;
				console.error(err);
				setProjectsError("Could not load the project list. Try again.");
			}
		}
		fetchProjects();

		return () => controller.abort();
	}, [API_BASE, getInitialProject, retryToken]);

	// Update URL when project or filters change
	useEffect(() => {
		if (selectedSlug && typeof window !== "undefined") {
			const url = new URL(window.location.href);
			url.searchParams.set("project", selectedSlug);
			url.searchParams.delete("filter");
			for (const filter of filterParams) url.searchParams.append("filter", filter);
			window.history.replaceState({}, "", url.toString());
		}
	}, [selectedSlug, filterParams]);

	// Derived metrics
	const totals = useMemo(() => {
		if (!stats) return { views: 0, visitors: 0, bounce: null };

		let views = 0;
		let visitors = 0;
		let bounceWeightedSum = 0;
		let totalPageviewsWithBounce = 0;

		for (const entry of stats.timeseries) {
			views += entry.pageviews;
			visitors += entry.visitors;
			if (entry.bounce_rate > 0 && entry.pageviews > 0) {
				bounceWeightedSum += entry.bounce_rate * entry.pageviews;
				totalPageviewsWithBounce += entry.pageviews;
			}
		}

		// PostHog reports no bounce rate, so live-only views have none to show.
		const bounce = totalPageviewsWithBounce > 0
			? bounceWeightedSum / totalPageviewsWithBounce
			: null;

		return { views, visitors, bounce };
	}, [stats]);

	const chartData = useMemo(() => {
		if (!stats) return [];
		return aggregateTimeseries(stats.timeseries, granularity);
	}, [stats, granularity]);

	const sparks = useMemo(() => {
		if (!stats) return { views: [], visitors: [], bounce: [] };
		return {
			views: downsample(stats.timeseries.map((d) => d.pageviews)),
			visitors: downsample(stats.timeseries.map((d) => d.visitors)),
			bounce: downsample(stats.timeseries.map((d) => d.bounce_rate)),
		};
	}, [stats]);

	const maxPathPageviews = useMemo(() =>
		stats ? Math.max(...stats.stats.path.map((s) => s.pageviews), 1) : 1,
		[stats]
	);

	const maxReferrerPageviews = useMemo(() =>
		stats ? Math.max(...stats.stats.referrer.map((s) => s.pageviews), 1) : 1,
		[stats]
	);

	const maxCountryPageviews = useMemo(() =>
		stats ? Math.max(...stats.stats.country.map((s) => s.pageviews), 1) : 1,
		[stats]
	);

	const displayedProjectName = projects.find((p) => p.slug === snapshot?.slug)?.name ?? snapshot?.slug;

	return (
		<div className="w-full max-w-7xl mx-auto pb-12 space-y-5">
			{/* Header row: title left, controls right */}
			<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 dark:from-foreground dark:to-muted-foreground bg-clip-text text-transparent">
						Project Stats
					</h1>
					<p className="text-muted-foreground text-sm sm:text-base mt-1">
						Live traffic and engagement metrics across deployed projects
					</p>
					{stats && (
						<div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
							<time dateTime={stats.metadata.export_date} title={formatFetchedAt(stats.metadata.export_date).absolute}>
								Updated {now ? formatFetchedAt(stats.metadata.export_date, now).relative : "…"}
							</time>
							<Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
								{loading && !pending && <Loader2 className="w-3 h-3 animate-spin motion-reduce:animate-none" />}
								{loading && !pending ? "Refreshing" : "Refresh stats"}
							</Button>
						</div>
					)}
				</div>

				<div className="flex flex-col sm:flex-row gap-3">
					<Select
						onOpenChange={() => trigger("light")}
						value={selectedSlug}
						onValueChange={(v) => {
							trigger("selection");
							setSelectedSlug(v);
							setFilters([]);
						}}
					>
						<SelectTrigger data-haptic="manual" className="w-full sm:w-[240px] bg-card border-border hover:border-accent focus:ring-primary/20 ring-offset-0 text-foreground transition-colors">
							<SelectValue placeholder="Select Project" />
						</SelectTrigger>
						<SelectContent className="bg-card border-border">
							{projects.map((p) => (
								<SelectItem
									key={p.slug}
									value={p.slug}
									className="text-foreground focus:bg-accent focus:text-accent-foreground cursor-pointer"
								>
									{p.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select
						onOpenChange={() => trigger("light")}
						value={period}
						onValueChange={(v) => {
							trigger("selection");
							setPeriod(v);
						}}
					>
						<SelectTrigger data-haptic="manual" className="w-full sm:w-[160px] bg-card border-border hover:border-accent focus:ring-primary/20 ring-offset-0 text-foreground transition-colors">
							<Calendar className="w-3.5 h-3.5 mr-2 text-primary/60" />
							<SelectValue placeholder="Period" />
						</SelectTrigger>
						<SelectContent className="bg-card border-border">
							<SelectItem value="7" className="text-foreground focus:bg-accent focus:text-accent-foreground cursor-pointer">Last 7 days</SelectItem>
							<SelectItem value="30" className="text-foreground focus:bg-accent focus:text-accent-foreground cursor-pointer">Last 30 days</SelectItem>
							<SelectItem value="90" className="text-foreground focus:bg-accent focus:text-accent-foreground cursor-pointer">Last 90 days</SelectItem>
							<SelectItem value="365" className="text-foreground focus:bg-accent focus:text-accent-foreground cursor-pointer">Last 365 days</SelectItem>
							<SelectItem value="0" className="text-foreground focus:bg-accent focus:text-accent-foreground cursor-pointer">Lifetime</SelectItem>
						</SelectContent>
					</Select>

					<Select
						onOpenChange={() => trigger("light")}
						value={granularity}
						onValueChange={(v) => {
							trigger("selection");
							setGranularity(v as Granularity);
						}}
					>
						<SelectTrigger data-haptic="manual" className="w-full sm:w-[140px] bg-card border-border hover:border-accent focus:ring-primary/20 ring-offset-0 text-foreground transition-colors">
							<Activity className="w-3.5 h-3.5 mr-2 text-primary/60" />
							<SelectValue placeholder="Group by" />
						</SelectTrigger>
						<SelectContent className="bg-card border-border">
							<SelectItem value="day" className="text-foreground focus:bg-accent focus:text-accent-foreground cursor-pointer">Daily</SelectItem>
							<SelectItem value="week" className="text-foreground focus:bg-accent focus:text-accent-foreground cursor-pointer">Weekly</SelectItem>
							<SelectItem value="month" className="text-foreground focus:bg-accent focus:text-accent-foreground cursor-pointer">Monthly</SelectItem>
							<SelectItem value="year" className="text-foreground focus:bg-accent focus:text-accent-foreground cursor-pointer">Yearly</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			{filters.length > 0 && (
				<div className="flex flex-wrap items-center gap-2 text-xs">
					<span className="text-muted-foreground">Filtered by</span>
					{filters.map((f) => (
						<button
							type="button"
							key={f.field}
							onClick={() => selectFilter(f.field, f.value)}
							aria-label={`Remove ${FILTER_LABELS[f.field]} filter`}
							className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-foreground hover:border-accent transition-colors"
						>
							<span className="text-muted-foreground">{FILTER_LABELS[f.field]}</span>
							<span className="font-medium max-w-[16rem] truncate">{f.value}</span>
							<X className="w-3 h-3 text-muted-foreground" />
						</button>
					))}
					<Button variant="ghost" size="sm" onClick={() => { trigger("selection"); setFilters([]); }}>Clear</Button>
					{stats?.metadata.excludes_history ? (
						<span className="basis-full text-muted-foreground">
							Vercel Analytics history splits by one field at a time, so with more than one filter it's left out and these numbers are live analytics only.
						</span>
					) : stats?.metadata.history_field ? (
						<span className="basis-full text-muted-foreground">
							Vercel Analytics history counts in the chart, the totals and the {FILTER_LABELS[stats.metadata.history_field]} list. It only kept totals per field, so the other lists are live analytics only.
						</span>
					) : null}
				</div>
			)}

			{((error && stats) || (loading && slow)) && (
				<Alert role="status" aria-live="polite">
					<AlertDescription>
						{error || "Fetching historical data. This is taking longer than usual."}
						{error && stats && <span> Showing {displayedProjectName}, {displayedPeriod === "0" ? "lifetime" : `last ${displayedPeriod} days`}.</span>}
						{error && stats && <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>Try again</Button>}
					</AlertDescription>
				</Alert>
			)}

			{/* Error */}
			{error && !stats ? (
				<div className="rounded-xl border border-destructive/40 bg-destructive/10 p-8 text-center">
					<Activity className="w-5 h-5 text-destructive mx-auto mb-3" />
					<p className="text-destructive font-semibold text-sm tracking-wide mb-1.5">
						Couldn't load analytics
					</p>
					<p className="text-muted-foreground text-sm mb-5 max-w-md mx-auto">{error}</p>
					<button
						type="button"
						onClick={() => {
							trigger("selection");
							if (projectsError) setRetryToken((t) => t + 1);
							else refresh();
						}}
						className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:border-accent hover:bg-muted/50 transition-colors"
					>
						Try again
					</button>
				</div>
			) : !stats ? (
				<div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading analytics charts">
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-4" aria-hidden="true">
						{[1, 2, 3].map((i) => (
							<div key={i} className={`${CARD} p-5 flex flex-col gap-4`}>
								<Skeleton className="h-3 w-24 motion-reduce:animate-none" />
								<Skeleton className="h-8 w-32 motion-reduce:animate-none" />
								<Skeleton className="h-3 w-20 motion-reduce:animate-none" />
							</div>
						))}
					</div>
					<div className={`${CARD} p-5 flex flex-col gap-6`} aria-hidden="true">
						<Skeleton className="h-4 w-40 motion-reduce:animate-none" />
						<Skeleton className="h-[300px] w-full motion-reduce:animate-none" />
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5" aria-hidden="true">
						{[1, 2, 3].map((i) => (
							<div key={i} className={`${CARD} p-5 flex flex-col gap-5`}>
								<Skeleton className="h-3 w-28 motion-reduce:animate-none" />
								{[1, 2, 3, 4, 5].map((row) => (
									<div key={row} className="flex flex-col gap-2">
										<div className="flex justify-between gap-4">
											<Skeleton className="h-3.5 motion-reduce:animate-none" style={{ width: `${70 - row * 9}%` }} />
											<Skeleton className="h-3.5 w-10 motion-reduce:animate-none" />
										</div>
										<Skeleton className="h-1 motion-reduce:animate-none" style={{ width: `${100 - row * 16}%` }} />
									</div>
								))}
							</div>
						))}
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-5" aria-hidden="true">
						{[1, 2].map((i) => (
							<div key={i} className={`${CARD} p-5 flex flex-col items-center gap-6`}>
								<Skeleton className="h-3 w-32 self-start motion-reduce:animate-none" />
								<Skeleton className="size-44 rounded-full motion-reduce:animate-none" />
								<Skeleton className="h-3 w-48 motion-reduce:animate-none" />
							</div>
						))}
					</div>
				</div>
			) : (
				<div className="relative">
					{pending && (
						<div className="sticky top-20 z-20 h-0 flex justify-center" role="status" aria-live="polite">
							<span className="mt-2 inline-flex items-center gap-2 rounded-full border border-border bg-card/95 px-4 py-2 text-sm text-foreground shadow-lg backdrop-blur">
								<Loader2 className="w-4 h-4 animate-spin text-primary motion-reduce:animate-none" />
								{pendingLabel}…
							</span>
						</div>
					)}
					<div
						aria-busy={pending}
						className={cn(
							"space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 transition-opacity",
							pending && "opacity-40 saturate-50 pointer-events-none select-none",
						)}
					>
						{/* Metric Cards */}
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
							<MetricCard
								title="Pageviews"
								value={totals.views.toLocaleString()}
								icon={Eye}
								trend={displayedPeriod === "0" ? "Lifetime" : `Last ${displayedPeriod} days`}
								accentColor="var(--color-chart-2)"
								spark={sparks.views}
							/>
							<MetricCard
								title="Visitors"
								value={totals.visitors.toLocaleString()}
								icon={Users}
								trend="Unique sessions"
								accentColor="var(--color-chart-3)"
								spark={sparks.visitors}
							/>
							<MetricCard
								title="Bounce Rate"
								value={totals.bounce === null ? "—" : `${totals.bounce.toFixed(1)}%`}
								icon={Activity}
								trend={totals.bounce === null ? "Not tracked for this view" : "Weighted average"}
								accentColor="var(--color-chart-1)"
								spark={sparks.bounce}
							/>
						</div>

						{/* Main Chart Tabs */}
						<Tabs defaultValue="traffic" className="w-full" onValueChange={() => trigger("selection")}>
							<div className={cn(CARD, "overflow-hidden")}>
								{/* Tab bar */}
								<div className="border-b border-border px-6 pt-5 pb-0 flex items-end justify-between">
									<TabsList className="bg-transparent p-0 gap-0 h-auto rounded-none border-0">
										<TabsTrigger
											value="traffic"
											className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-chart-2 data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none text-muted-foreground hover:text-foreground px-4 pb-3 pt-0 text-sm font-medium transition-colors bg-transparent shadow-none"
										>
											Traffic
										</TabsTrigger>
										<TabsTrigger
											value="visitors"
											className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-chart-3 data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none text-muted-foreground hover:text-foreground px-4 pb-3 pt-0 text-sm font-medium transition-colors bg-transparent shadow-none"
										>
											Visitors
										</TabsTrigger>
										<TabsTrigger
											value="bounce"
											className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-chart-1 data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none text-muted-foreground hover:text-foreground px-4 pb-3 pt-0 text-sm font-medium transition-colors bg-transparent shadow-none"
										>
											Bounce Rate
										</TabsTrigger>
									</TabsList>
									<div className="hidden md:block pb-3">
										<span className="whitespace-nowrap text-[10px] font-bold tracking-[0.15em] text-muted-foreground bg-muted border border-border px-2.5 py-1 rounded-md">
											{displayedPeriod === "0" ? "Lifetime" : `${displayedPeriod}d`} · {GRANULARITY_LABELS[granularity]}
										</span>
									</div>
								</div>

								{/* Chart content */}
								<div className="p-6">
									<TabsContent value="traffic" className="mt-0 space-y-4">
										<div>
											<h3 className="text-foreground font-semibold text-base">Pageviews Over Time</h3>
											<p className="text-muted-foreground text-xs mt-0.5">{GRANULARITY_LABELS[granularity]} pageview count for the displayed period</p>
										</div>
										<TimeseriesAreaChart
											data={chartData}
											dataKey="pageviews"
											color="var(--color-chart-2)"
											height={260}
											granularity={granularity}
										/>
									</TabsContent>

									<TabsContent value="visitors" className="mt-0 space-y-4">
										<div>
											<h3 className="text-foreground font-semibold text-base">Visitors Over Time</h3>
											<p className="text-muted-foreground text-xs mt-0.5">{GRANULARITY_LABELS[granularity]} unique visitor count for the displayed period</p>
										</div>
										<TimeseriesAreaChart
											data={chartData}
											dataKey="visitors"
											color="var(--color-chart-3)"
											height={260}
											granularity={granularity}
										/>
									</TabsContent>

									<TabsContent value="bounce" className="mt-0 space-y-4">
										<div>
											<h3 className="text-foreground font-semibold text-base">Bounce Rate</h3>
											<p className="text-muted-foreground text-xs mt-0.5">Percentage of single-page sessions, {GRANULARITY_LABELS[granularity].toLowerCase()} average</p>
										</div>
										<TimeseriesAreaChart
											data={chartData}
											dataKey="bounce_rate"
											color="var(--color-chart-1)"
											height={260}
											unit="%"
											granularity={granularity}
										/>
									</TabsContent>
								</div>
							</div>
						</Tabs>

						{/* Breakdowns */}
						<div className="space-y-6">
							{/* Section divider */}
							<div className="flex items-center gap-4">
								<div className="h-px flex-1 bg-border" />
								<span className="text-[10px] font-bold tracking-[0.22em] text-muted-foreground">
									Traffic Breakdown
								</span>
								<div className="h-px flex-1 bg-border" />
							</div>

							{/* List breakdowns */}
							<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
								<BreakdownList
									title="Top Paths"
									items={stats.stats.path}
									maxVal={maxPathPageviews}
									field="path"
									active={activeFilter.path}
									onSelect={selectFilter}
									icon={Eye}
								/>
								<BreakdownList
									title="Top Referrers"
									items={stats.stats.referrer}
									maxVal={maxReferrerPageviews}
									field="referrer"
									active={activeFilter.referrer}
									onSelect={selectFilter}
									icon={Globe}
								/>
								<BreakdownList
									title="Top Countries"
									items={stats.stats.country}
									maxVal={maxCountryPageviews}
									field="country"
									active={activeFilter.country}
									onSelect={selectFilter}
									icon={Globe}
								/>
							</div>

							{/* Device & OS */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
								{stats.stats.device_type.length > 0 && (
									<BreakdownChartCard title="Device Types" icon={Smartphone}>
										<DonutChart data={stats.stats.device_type} title="Device Types" active={activeFilter.device_type} onSelect={(key) => selectFilter("device_type", key)} />
									</BreakdownChartCard>
								)}
								{stats.stats.os_name.length > 0 && (
									<BreakdownChartCard title="Operating Systems" icon={Monitor}>
										<DonutChart data={stats.stats.os_name} title="OS" active={activeFilter.os_name} onSelect={(key) => selectFilter("os_name", key)} />
									</BreakdownChartCard>
								)}
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
