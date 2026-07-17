import React, { useState, useEffect, useMemo, useCallback, memo, useRef, useLayoutEffect } from "react";
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
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import DataFreshness from "@/components/DataFreshness";
import {
	dispatchLiveRefreshed,
	writeStoredFetchedAt,
} from "@/lib/dataFreshness";
import {
	AreaChart,
	Area,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	PieChart,
	Pie,
	Cell,
	BarChart,
	Bar,
	ResponsiveContainer,
} from "recharts";
import { useWebHaptics } from "web-haptics/react";

// --- Shared Tooltip Styles ---
const TOOLTIP_STYLES = {
	contentStyle: {
		backgroundColor: "var(--color-popover)",
		borderColor: "var(--color-border)",
		borderRadius: "8px",
		borderWidth: "1px",
		color: "var(--color-popover-foreground)",
		boxShadow: "var(--shadow-lg)",
		padding: "10px 14px",
	},
	itemStyle: {
		color: "var(--color-muted-foreground)",
		fontSize: "12px",
		fontWeight: "500",
		lineHeight: "1.6",
		fontFamily: "var(--font-mono)",
	},
	labelStyle: {
		color: "var(--color-primary)",
		marginBottom: "6px",
		fontSize: "10px",
		fontWeight: "700",
		letterSpacing: "0.1em",
		textTransform: "uppercase" as const,
	},
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
	metadata: { export_date: string; source: string };
	timeseries: TimeseriesEntry[];
	stats: StatsBreakdown;
};

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

// --- Chart Components ---

const RechartsAreaChart = memo(({
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
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [chartWidth, setChartWidth] = useState<number>(0);

	useLayoutEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const updateWidth = () => {
			const nextWidth = Math.floor(el.getBoundingClientRect().width);
			setChartWidth((prev) => (prev !== nextWidth ? nextWidth : prev));
		};

		updateWidth();

		const ro = new ResizeObserver(() => updateWidth());
		ro.observe(el);

		window.addEventListener("orientationchange", updateWidth);
		window.addEventListener("resize", updateWidth);

		return () => {
			ro.disconnect();
			window.removeEventListener("orientationchange", updateWidth);
			window.removeEventListener("resize", updateWidth);
		};
	}, []);

	const formattedData = useMemo(() => {
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
				...d,
				rawDate: d.date,
				formattedDate: safeDate,
				displayValue:
					dataKey === "bounce_rate"
						? Math.round(d[dataKey] * 100) / 100
						: d[dataKey],
			};
		});
	}, [data, dataKey, granularity]);

	const tooltipFormatter = useCallback((value: number | undefined) => {
		const numValue = value ?? 0;
		return [
			`${numValue}${unit}`,
			dataKey.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
		];
	}, [dataKey, unit]);

	if (formattedData.length === 0)
		return (
			<div style={{ height }}>
				<ChartEmpty label="no data available" />
			</div>
		);

	return (
		<div ref={containerRef} style={{ width: "100%", height: height || 300 }}>
			{chartWidth > 0 ? (
				<AreaChart
					width={chartWidth}
					height={height || 300}
					data={formattedData}
					margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
				>
					<defs>
						<linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stopColor={color} stopOpacity={0.18} />
							<stop offset="100%" stopColor={color} stopOpacity={0} />
						</linearGradient>
					</defs>
					<CartesianGrid strokeDasharray="0" vertical={false} stroke="var(--color-border)" opacity={1} />
					<XAxis
						dataKey="formattedDate"
						fontSize={11}
						tickLine={false}
						axisLine={false}
						tick={{ fill: "var(--color-muted-foreground)" }}
						interval="preserveStartEnd"
						minTickGap={20}
					/>
					<YAxis
						fontSize={11}
						tickLine={false}
						axisLine={false}
						tickFormatter={(value) => `${value.toLocaleString()}${unit}`}
						tick={{ fill: "var(--color-muted-foreground)" }}
						width={44}
					/>
					<Tooltip
						contentStyle={TOOLTIP_STYLES.contentStyle}
						itemStyle={TOOLTIP_STYLES.itemStyle}
						labelStyle={TOOLTIP_STYLES.labelStyle}
						formatter={tooltipFormatter}
					/>
					<Area
						type="monotone"
						dataKey={dataKey === "bounce_rate" ? "displayValue" : dataKey}
						stroke={color}
						fill={`url(#grad-${dataKey})`}
						strokeWidth={1.5}
						connectNulls
						isAnimationActive={false}
					/>
				</AreaChart>
			) : (
				<div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>
					Loading chart...
				</div>
			)}
		</div>
	);
});
RechartsAreaChart.displayName = "RechartsAreaChart";

const DonutChart = memo(({
	data,
	title,
	height = 300,
}: {
	data: StatEntry[];
	title: string;
	height?: number;
}) => {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [chartWidth, setChartWidth] = useState<number>(0);

	useLayoutEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const updateWidth = () => {
			const nextWidth = Math.floor(el.getBoundingClientRect().width);
			setChartWidth((prev) => (prev !== nextWidth ? nextWidth : prev));
		};

		updateWidth();

		const ro = new ResizeObserver(() => updateWidth());
		ro.observe(el);

		window.addEventListener("orientationchange", updateWidth);
		window.addEventListener("resize", updateWidth);

		return () => {
			ro.disconnect();
			window.removeEventListener("orientationchange", updateWidth);
			window.removeEventListener("resize", updateWidth);
		};
	}, []);

	const chartData = useMemo(() =>
		data.slice(0, 5).map((item) => ({
			name: item.key,
			value: item.pageviews,
		})),
		[data]
	);

	const chartHeight = useMemo(() => {
		const legendRows = Math.max(1, Math.ceil(chartData.length / 3));
		const legendHeight = legendRows * 28;
		return Math.max(170, height - legendHeight - 16);
	}, [chartData.length, height]);

	const outerRadius = useMemo(() => {
		if (chartWidth === 0) return 72;
		return Math.max(44, Math.min(82, Math.floor(chartWidth * 0.24)));
	}, [chartWidth]);

	const innerRadius = useMemo(() => Math.max(30, Math.floor(outerRadius * 0.68)), [outerRadius]);

	const cells = useMemo(() =>
		chartData.map((_, index) => (
			<Cell key={index} fill={COLORS[index % COLORS.length]} stroke="transparent" />
		)),
		[chartData]
	);

	if (chartData.length === 0) {
		return (
			<ChartEmpty />
		);
	}

	return (
		<div className="w-full h-full flex flex-col justify-center">
			<div ref={containerRef} style={{ width: "100%", height: chartHeight }}>
				{chartWidth > 0 ? (
					<PieChart width={chartWidth} height={chartHeight}>
						<Pie
							data={chartData}
							cx="50%"
							cy="50%"
							innerRadius={innerRadius}
							outerRadius={outerRadius}
							paddingAngle={3}
							dataKey="value"
							isAnimationActive={false}
						>
							{cells}
						</Pie>
						<Tooltip
							contentStyle={TOOLTIP_STYLES.contentStyle}
							itemStyle={TOOLTIP_STYLES.itemStyle}
						/>
					</PieChart>
				) : (
					<div className="flex items-center justify-center h-full text-muted-foreground text-sm">
						Loading chart...
					</div>
				)}
			</div>

			<div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2">
				{chartData.map((entry, index) => (
					<div key={`${title}-${entry.name}`} className="inline-flex items-center gap-1.5">
						<span
							className="h-2 w-2 rounded-sm shrink-0"
							style={{ backgroundColor: COLORS[index % COLORS.length] }}
						/>
						<span className="text-[11px] text-muted-foreground font-medium">{entry.name}</span>
					</div>
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
	const chartData = useMemo(() =>
		data.slice(0, 8).map((item) => ({
			name: item.key,
			value: item.pageviews,
		})),
		[data]
	);

	const cells = useMemo(() =>
		chartData.map((_, index) => (
			<Cell key={index} fill={COLORS[index % COLORS.length]} />
		)),
		[chartData]
	);

	if (chartData.length === 0) {
		return (
			<ChartEmpty />
		);
	}

	return (
		<ResponsiveContainer width="100%" height={height}>
			<BarChart
				layout="vertical"
				data={chartData}
				margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
			>
				<CartesianGrid strokeDasharray="0" horizontal={false} stroke="var(--color-border)" opacity={1} />
				<XAxis type="number" hide />
				<YAxis
					dataKey="name"
					type="category"
					width={100}
					tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
					interval={0}
				/>
				<Tooltip
					cursor={{ fill: "var(--color-muted)" }}
					contentStyle={TOOLTIP_STYLES.contentStyle}
					itemStyle={TOOLTIP_STYLES.itemStyle}
				/>
				<Bar dataKey="value" radius={[0, 3, 3, 0]} isAnimationActive={false}>
					{cells}
				</Bar>
			</BarChart>
		</ResponsiveContainer>
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
		<p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground pl-4 flex items-center gap-2">
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
const BreakdownList = memo(({
	title,
	items,
	maxVal,
	icon: Icon,
}: {
	title: string;
	items: StatEntry[];
	maxVal: number;
	icon?: React.ComponentType<{ className?: string }>;
}) => (
	<div className={cn(CARD, "max-h-[300px] sm:max-h-[400px] md:h-[400px] flex flex-col")}>
		<div className="px-5 py-3.5 border-b border-border flex items-center gap-2 shrink-0">
			{Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
			<span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
				{title}
			</span>
		</div>
		<div className="flex-1 overflow-auto no-scrollbar">
			{items.length === 0 ? (
				<ChartEmpty label="no data available" />
			) : (
				<div className="divide-y divide-border">
					{items.map((item, i) => (
						<div key={item.key} className="group px-5 py-3 hover:bg-muted/50 transition-colors">
							<div className="flex justify-between items-baseline gap-3 mb-2">
								<span
									className="text-sm text-foreground truncate font-medium group-hover:text-primary transition-colors"
									title={item.key}
								>
									{item.key.replace(/^https?:\/\/[^/]+/, "") || "/"}
								</span>
								<span className="text-xs font-mono text-muted-foreground shrink-0 tabular-nums">
									{item.pageviews.toLocaleString()}
								</span>
							</div>
							<ProgressBar value={item.pageviews} maxVal={maxVal} index={i} />
						</div>
					))}
				</div>
			)}
		</div>
	</div>
));
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
			<span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
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
	const [stats, setStats] = useState<AllStats | null>(null);
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [period, setPeriod] = useState<string>("0");
	const [granularity, setGranularity] = useState<Granularity>("week");
	const [retryToken, setRetryToken] = useState<number>(0);
	const { trigger } = useWebHaptics();
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

	const loadStats = useCallback(
		async (
			slug: string,
			days: string,
			opts: { refresh?: boolean; signal?: AbortSignal } = {},
		) => {
			const { refresh = false, signal } = opts;
			const params = new URLSearchParams({
				slugs: slug,
				days,
			});
			if (refresh) params.set("refresh", "true");

			const res = await fetch(`${API_BASE}/v1/stats?${params.toString()}`, {
				signal,
				cache: refresh ? "no-store" : "default",
			});
			if (!res.ok) {
				let detail = "Failed to fetch stats";
				try {
					const body = await res.json();
					if (body?.detail) detail = body.detail;
				} catch {
					// Ignore JSON parse errors and keep generic detail
				}
				throw new Error(`${detail} (${res.status})`);
			}
			const body = await res.json();
			const result = body?.results?.[0];

			if (result?.error) {
				throw new Error(result.error);
			}

			return (result?.data as AllStats | null) || null;
		},
		[API_BASE],
	);

	// Fetch Projects List
	useEffect(() => {
		const controller = new AbortController();

		async function fetchProjects() {
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
				setError("Could not load projects from " + API_BASE);
			}
		}
		fetchProjects();

		return () => controller.abort();
	}, [API_BASE, getInitialProject, retryToken]);

	// Update URL when project changes
	useEffect(() => {
		if (selectedSlug && typeof window !== "undefined") {
			const url = new URL(window.location.href);
			url.searchParams.set("project", selectedSlug);
			window.history.replaceState({}, "", url.toString());
		}
	}, [selectedSlug]);

	// Fetch Stats when selection / period changes (initial + normal loads)
	useEffect(() => {
		if (!selectedSlug) return;

		const controller = new AbortController();

		async function fetchStats() {
			setLoading(true);
			setError(null);
			try {
				const data = await loadStats(selectedSlug, period, {
					signal: controller.signal,
				});
				setStats(data);
			} catch (err) {
				if (err instanceof Error && err.name === 'AbortError') return;
				console.error(err);
				setError(err instanceof Error ? err.message : "Failed to load stats for this project.");
				setStats(null);
			} finally {
				setLoading(false);
			}
		}

		fetchStats();

		return () => controller.abort();
	}, [selectedSlug, period, loadStats, retryToken]);

	const handleRefreshStats = useCallback(async () => {
		if (!selectedSlug) throw new Error("No project selected");
		const data = await loadStats(selectedSlug, period, { refresh: true });
		setStats(data);
		const at = data?.metadata?.export_date ?? new Date().toISOString();
		writeStoredFetchedAt("project-stats", at);
		dispatchLiveRefreshed("project-stats", at);
	}, [selectedSlug, period, loadStats]);

	// Derived metrics
	const totals = useMemo(() => {
		if (!stats) return { views: 0, visitors: 0, bounce: 0 };

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

		const bounce = totalPageviewsWithBounce > 0
			? bounceWeightedSum / totalPageviewsWithBounce
			: 0;

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

	// Initial project load
	if (projects.length === 0 && !error) {
		return (
			<div className="flex flex-col items-center justify-center py-24 gap-4">
				<div className="relative w-8 h-8">
					<div className="absolute inset-0 border-[1.5px] border-primary/20 rounded-full" />
					<div className="absolute inset-0 border-[1.5px] border-primary border-t-transparent rounded-full animate-spin" />
				</div>
				<p className="text-muted-foreground text-sm font-medium tracking-wide">Loading analytics...</p>
			</div>
		);
	}

	const selectedProjectName =
		projects.find((p) => p.slug === selectedSlug)?.name ?? selectedSlug;

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
					{stats?.metadata?.export_date && (
						<div className="mt-3">
							<DataFreshness
								source="project-stats"
								fetchedAt={stats.metadata.export_date}
								label="Project analytics"
								description={`Re-fetch live analytics for ${selectedProjectName}. This bypasses the cache and may take a few seconds.`}
								onRefresh={handleRefreshStats}
							/>
						</div>
					)}
				</div>

				<div className="flex flex-col sm:flex-row gap-3">
					<Select
						value={selectedSlug}
						onValueChange={(v) => {
							trigger("selection");
							setLoading(true);
							setSelectedSlug(v);
						}}
					>
						<SelectTrigger className="w-full sm:w-[240px] bg-card border-border hover:border-accent focus:ring-primary/20 ring-offset-0 text-foreground transition-colors">
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
						value={period}
						onValueChange={(v) => {
							trigger("selection");
							setLoading(true);
							setPeriod(v);
						}}
					>
						<SelectTrigger className="w-full sm:w-[160px] bg-card border-border hover:border-accent focus:ring-primary/20 ring-offset-0 text-foreground transition-colors">
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
						value={granularity}
						onValueChange={(v) => {
							trigger("selection");
							setGranularity(v as Granularity);
						}}
					>
						<SelectTrigger className="w-full sm:w-[140px] bg-card border-border hover:border-accent focus:ring-primary/20 ring-offset-0 text-foreground transition-colors">
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

			{/* Error */}
			{error ? (
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
							setError(null);
							setRetryToken((t) => t + 1);
						}}
						className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:border-accent hover:bg-muted/50 transition-colors"
					>
						Try again
					</button>
				</div>
			) : loading || !stats ? (
				/* Skeleton */
				<div className="space-y-6">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						{[1, 2, 3].map((i) => (
							<div key={i} className="h-32 rounded-xl bg-card border border-border animate-pulse" />
						))}
					</div>
					<div className="h-[380px] rounded-xl bg-card border border-border animate-pulse" />
				</div>
			) : (
				<div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
					{/* Metric Cards */}
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
						<MetricCard
							title="Pageviews"
							value={totals.views.toLocaleString()}
							icon={Eye}
							trend={period === "0" ? "Lifetime" : `Last ${period} days`}
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
							value={`${totals.bounce.toFixed(1)}%`}
							icon={Activity}
							trend="Weighted average"
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
									<span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground bg-muted border border-border px-2.5 py-1 rounded-md">
										{period === "0" ? "Lifetime" : `${period}d`} · {GRANULARITY_LABELS[granularity]}
									</span>
								</div>
							</div>

							{/* Chart content */}
							<div className="p-6">
								<TabsContent value="traffic" className="mt-0 space-y-4">
									<div>
										<h3 className="text-foreground font-semibold text-base">Pageviews Over Time</h3>
										<p className="text-muted-foreground text-xs mt-0.5">{GRANULARITY_LABELS[granularity]} pageview count for the selected period</p>
									</div>
									<RechartsAreaChart
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
										<p className="text-muted-foreground text-xs mt-0.5">{GRANULARITY_LABELS[granularity]} unique visitor count for the selected period</p>
									</div>
									<RechartsAreaChart
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
									<RechartsAreaChart
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
							<span className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
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
								icon={Eye}
							/>
							<BreakdownList
								title="Top Referrers"
								items={stats.stats.referrer}
								maxVal={maxReferrerPageviews}
								icon={Globe}
							/>
							<BreakdownList
								title="Top Countries"
								items={stats.stats.country}
								maxVal={maxCountryPageviews}
								icon={Globe}
							/>
						</div>

						{/* Device & OS */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
							{stats.stats.device_type.length > 0 && (
								<BreakdownChartCard title="Device Types" icon={Smartphone}>
									<DonutChart data={stats.stats.device_type} title="Device Types" />
								</BreakdownChartCard>
							)}
							{stats.stats.os_name.length > 0 && (
								<BreakdownChartCard title="Operating Systems" icon={Monitor}>
									<DonutChart data={stats.stats.os_name} title="OS" />
								</BreakdownChartCard>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
