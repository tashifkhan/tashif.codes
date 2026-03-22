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
		backgroundColor: "rgba(8, 10, 15, 0.98)",
		borderColor: "rgba(255, 152, 0, 0.2)",
		borderRadius: "8px",
		borderWidth: "1px",
		color: "#e2e8f0",
		boxShadow: "0 16px 48px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.03) inset",
		padding: "10px 14px",
	},
	itemStyle: {
		color: "#94a3b8",
		fontSize: "12px",
		fontWeight: "500",
		lineHeight: "1.6",
		fontFamily: "ui-monospace, SFMono-Regular, monospace",
	},
	labelStyle: {
		color: "#ff9800",
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

// --- Constants ---

const COLORS = [
	"#ff9800", // amber
	"#60a5fa", // blue
	"#34d399", // emerald
	"#f472b6", // pink
	"#a78bfa", // violet
];

// Colors are already SVG-compatible hex
const oklchToRgb = (color: string): string => color;

// Base card class — flat dark surface with hairline border
const CARD = "rounded-xl border border-[#1a1d2a] bg-[#0d0e15] transition-colors hover:border-[#252a3a]";

// --- Chart Components ---

const RechartsAreaChart = memo(({
	data,
	dataKey,
	color,
	height = 300,
	unit = "",
}: {
	data: TimeseriesEntry[];
	dataKey: "pageviews" | "visitors" | "bounce_rate";
	color: string;
	height?: number;
	unit?: string;
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

		return data.map((d) => {
			const parsedDate = new Date(d.date);
			const safeDate = isNaN(parsedDate.getTime())
				? String(d.date).split("T")[0]
				: parsedDate.toLocaleDateString(undefined, {
						month: "short",
						day: "numeric",
				  });

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
	}, [data, dataKey]);

	const tooltipFormatter = useCallback((value: number | undefined) => {
		const numValue = value ?? 0;
		return [
			`${numValue}${unit}`,
			dataKey.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
		];
	}, [dataKey, unit]);

	if (formattedData.length === 0)
		return (
			<div className="flex items-center justify-center text-slate-600 text-sm" style={{ height }}>
				No data available
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
					<CartesianGrid strokeDasharray="0" vertical={false} stroke="#1a1d2a" opacity={1} />
					<XAxis
						dataKey="formattedDate"
						fontSize={11}
						tickLine={false}
						axisLine={false}
						tick={{ fill: "#475569" }}
						interval="preserveStartEnd"
						minTickGap={20}
					/>
					<YAxis
						fontSize={11}
						tickLine={false}
						axisLine={false}
						tickFormatter={(value) => `${value.toLocaleString()}${unit}`}
						tick={{ fill: "#475569" }}
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
				<div className="flex items-center justify-center text-slate-600 text-sm" style={{ height }}>
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
			<div className="flex flex-col items-center justify-center h-full text-slate-600 text-xs">
				<Activity className="w-4 h-4 mb-1 opacity-20" />
				No data
			</div>
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
					<div className="flex items-center justify-center h-full text-slate-600 text-sm">
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
						<span className="text-[11px] text-slate-400 font-medium">{entry.name}</span>
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
			<Cell key={index} fill={oklchToRgb(COLORS[index % COLORS.length])} />
		)),
		[chartData]
	);

	if (chartData.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-full text-slate-600 text-xs">
				<Activity className="w-4 h-4 mb-1 opacity-20" />
				No data
			</div>
		);
	}

	return (
		<ResponsiveContainer width="100%" height={height}>
			<BarChart
				layout="vertical"
				data={chartData}
				margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
			>
				<CartesianGrid strokeDasharray="0" horizontal={false} stroke="#1a1d2a" opacity={1} />
				<XAxis type="number" hide />
				<YAxis
					dataKey="name"
					type="category"
					width={100}
					tick={{ fontSize: 11, fill: "#475569" }}
					interval={0}
				/>
				<Tooltip
					cursor={{ fill: "rgba(255,255,255,0.03)" }}
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

// --- MetricCard ---
const MetricCard = memo(({
	title,
	value,
	icon: Icon,
	trend,
	accentColor = "#ff9800",
}: {
	title: string;
	value: string | number;
	icon: React.ComponentType<{ className?: string }>;
	trend?: string;
	accentColor?: string;
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
		<p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 pl-4 flex items-center gap-2">
			<Icon className="w-3 h-3" />
			{title}
		</p>
		<div className="text-[2.6rem] leading-none font-mono font-bold text-slate-100 pl-4 tracking-tight tabular-nums">
			{value}
		</div>
		{trend && (
			<p className="text-[11px] text-slate-600 pl-4">{trend}</p>
		)}
	</motion.div>
));
MetricCard.displayName = "MetricCard";

// --- ProgressBar ---
const ProgressBar = memo(({ value, maxVal, index }: { value: number; maxVal: number; index: number }) => (
	<div className="h-[2px] w-full bg-white/[0.04] rounded-full overflow-hidden">
		<motion.div
			className="h-full rounded-full"
			style={{ backgroundColor: "#ff9800", opacity: 0.55 }}
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
		<div className="px-5 py-3.5 border-b border-[#1a1d2a] flex items-center gap-2 shrink-0">
			{Icon && <Icon className="w-3.5 h-3.5 text-slate-600" />}
			<span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
				{title}
			</span>
		</div>
		<div className="flex-1 overflow-auto no-scrollbar">
			{items.length === 0 ? (
				<div className="flex flex-col items-center justify-center h-full text-slate-600 text-xs py-12">
					<Activity className="w-4 h-4 mb-2 opacity-20" />
					No data available
				</div>
			) : (
				<div className="divide-y divide-[#12141e]">
					{items.map((item, i) => (
						<div key={item.key} className="group px-5 py-3 hover:bg-white/[0.015] transition-colors">
							<div className="flex justify-between items-baseline gap-3 mb-2">
								<span
									className="text-sm text-slate-300 truncate font-medium group-hover:text-white transition-colors"
									title={item.key}
								>
									{item.key.replace(/^https?:\/\/[^/]+/, "") || "/"}
								</span>
								<span className="text-xs font-mono text-slate-500 shrink-0 tabular-nums">
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
		<div className="px-5 py-3.5 border-b border-[#1a1d2a] flex items-center gap-2 shrink-0">
			{Icon && <Icon className="w-3.5 h-3.5 text-slate-600" />}
			<span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
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
	const { trigger } = useWebHaptics();

	const API_BASE = useMemo(() => {
		const configured = import.meta.env.PUBLIC_API_BASE || "https://tashif-project-stats.vercel.app";
		return configured.replace(/\/+$/, "");
	}, []);

	const getInitialProject = useCallback(() => {
		if (typeof window !== "undefined") {
			const params = new URLSearchParams(window.location.search);
			return params.get("project") || "";
		}
		return "";
	}, []);

	// Fetch Projects List
	useEffect(() => {
		const controller = new AbortController();

		async function fetchProjects() {
			try {
				const res = await fetch(`${API_BASE}/api/v1/projects`, {
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
	}, [API_BASE, getInitialProject]);

	// Update URL when project changes
	useEffect(() => {
		if (selectedSlug && typeof window !== "undefined") {
			const url = new URL(window.location.href);
			url.searchParams.set("project", selectedSlug);
			window.history.replaceState({}, "", url.toString());
		}
	}, [selectedSlug]);

	// Fetch Stats when selection changes
	useEffect(() => {
		if (!selectedSlug) return;

		const controller = new AbortController();

		async function fetchStats() {
			setLoading(true);
			setError(null);
			try {
				const encodedSlug = encodeURIComponent(selectedSlug);
				const res = await fetch(
					`${API_BASE}/api/v1/stats?slugs=${encodedSlug}&days=${period}`,
					{ signal: controller.signal }
				);
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

				setStats(result?.data || null);
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
	}, [selectedSlug, period, API_BASE]);

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
		return stats.timeseries;
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
					<div className="absolute inset-0 border-[1.5px] border-orange-500/20 rounded-full" />
					<div className="absolute inset-0 border-[1.5px] border-orange-500 border-t-transparent rounded-full animate-spin" />
				</div>
				<p className="text-slate-500 text-sm font-medium tracking-wide">Loading analytics...</p>
			</div>
		);
	}

	return (
		<div className="w-full max-w-7xl mx-auto pb-12 space-y-8">
			{/* Controls */}
			<div className="flex flex-col sm:flex-row gap-3">
				<Select
					value={selectedSlug}
					onValueChange={(v) => {
						trigger("selection");
						setLoading(true);
						setSelectedSlug(v);
					}}
				>
					<SelectTrigger className="w-full sm:w-[240px] bg-[#0d0e15] border-[#1a1d2a] hover:border-[#2a2f3a] focus:ring-orange-500/20 ring-offset-0 text-slate-200 transition-colors">
						<SelectValue placeholder="Select Project" />
					</SelectTrigger>
					<SelectContent className="bg-[#0d0e15] border-[#1a1d2a]">
						{projects.map((p) => (
							<SelectItem
								key={p.slug}
								value={p.slug}
								className="text-slate-300 focus:bg-white/5 focus:text-white cursor-pointer"
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
					<SelectTrigger className="w-full sm:w-[160px] bg-[#0d0e15] border-[#1a1d2a] hover:border-[#2a2f3a] focus:ring-orange-500/20 ring-offset-0 text-slate-200 transition-colors">
						<Calendar className="w-3.5 h-3.5 mr-2 text-orange-500/60" />
						<SelectValue placeholder="Period" />
					</SelectTrigger>
					<SelectContent className="bg-[#0d0e15] border-[#1a1d2a]">
						<SelectItem value="7" className="text-slate-300 focus:bg-white/5 focus:text-white cursor-pointer">Last 7 days</SelectItem>
						<SelectItem value="30" className="text-slate-300 focus:bg-white/5 focus:text-white cursor-pointer">Last 30 days</SelectItem>
						<SelectItem value="90" className="text-slate-300 focus:bg-white/5 focus:text-white cursor-pointer">Last 90 days</SelectItem>
						<SelectItem value="365" className="text-slate-300 focus:bg-white/5 focus:text-white cursor-pointer">Last 365 days</SelectItem>
						<SelectItem value="0" className="text-slate-300 focus:bg-white/5 focus:text-white cursor-pointer">Lifetime</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* Error */}
			{error ? (
				<div className="rounded-xl border border-red-900/40 bg-red-950/20 p-6">
					<div className="flex items-center gap-3 mb-3">
						<Activity className="w-4 h-4 text-red-400" />
						<span className="text-red-400 font-semibold text-sm tracking-wide">Connection Error</span>
					</div>
					<p className="text-slate-400 text-sm mb-4">{error}</p>
					<div className="rounded-lg bg-[#0d0e15] border border-[#1a1d2a] p-4 text-sm font-mono text-slate-500">
						Troubleshooting:
						<ul className="list-disc list-inside mt-2 space-y-1">
							<li>Ensure the Python API is running on port 8000</li>
							<li>
								Check if{" "}
								<code className="text-orange-500/80 bg-orange-500/10 px-1 rounded">api/main.py</code>{" "}
								is executing without errors
							</li>
							<li>Verify network connectivity</li>
						</ul>
					</div>
				</div>
			) : loading || !stats ? (
				/* Skeleton */
				<div className="space-y-6">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						{[1, 2, 3].map((i) => (
							<div key={i} className="h-32 rounded-xl bg-[#0d0e15] border border-[#1a1d2a] animate-pulse" />
						))}
					</div>
					<div className="h-[380px] rounded-xl bg-[#0d0e15] border border-[#1a1d2a] animate-pulse" />
				</div>
			) : (
				<div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
					{/* Metric Cards */}
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
						<MetricCard
							title="Pageviews"
							value={totals.views.toLocaleString()}
							icon={Eye}
							trend={period === "0" ? "Lifetime" : `Last ${period} days`}
							accentColor="#60a5fa"
						/>
						<MetricCard
							title="Visitors"
							value={totals.visitors.toLocaleString()}
							icon={Users}
							trend="Unique sessions"
							accentColor="#34d399"
						/>
						<MetricCard
							title="Bounce Rate"
							value={`${totals.bounce.toFixed(1)}%`}
							icon={Activity}
							trend="Weighted average"
							accentColor="#ff9800"
						/>
					</div>

					{/* Main Chart Tabs */}
					<Tabs defaultValue="traffic" className="w-full" onValueChange={() => trigger("selection")}>
						<div className={cn(CARD, "overflow-hidden")}>
							{/* Tab bar */}
							<div className="border-b border-[#1a1d2a] px-6 pt-5 pb-0 flex items-end justify-between">
								<TabsList className="bg-transparent p-0 gap-0 h-auto rounded-none border-0">
									<TabsTrigger
										value="traffic"
										className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-blue-400 data-[state=active]:text-slate-100 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-slate-500 hover:text-slate-300 px-4 pb-3 pt-0 text-sm font-medium transition-colors bg-transparent shadow-none"
									>
										Traffic
									</TabsTrigger>
									<TabsTrigger
										value="visitors"
										className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-400 data-[state=active]:text-slate-100 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-slate-500 hover:text-slate-300 px-4 pb-3 pt-0 text-sm font-medium transition-colors bg-transparent shadow-none"
									>
										Visitors
									</TabsTrigger>
									<TabsTrigger
										value="bounce"
										className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-orange-400 data-[state=active]:text-slate-100 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-slate-500 hover:text-slate-300 px-4 pb-3 pt-0 text-sm font-medium transition-colors bg-transparent shadow-none"
									>
										Bounce Rate
									</TabsTrigger>
								</TabsList>
								<div className="pb-3">
									<span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600 bg-white/[0.03] border border-[#1a1d2a] px-2.5 py-1 rounded-md">
										{period === "0" ? "Lifetime" : `${period}d`}
									</span>
								</div>
							</div>

							{/* Chart content */}
							<div className="p-6">
								<TabsContent value="traffic" className="mt-0 space-y-4">
									<div>
										<h3 className="text-slate-200 font-semibold text-base">Pageviews Over Time</h3>
										<p className="text-slate-600 text-xs mt-0.5">Daily pageview count for the selected period</p>
									</div>
									<RechartsAreaChart
										data={chartData}
										dataKey="pageviews"
										color="#60a5fa"
										height={260}
									/>
								</TabsContent>

								<TabsContent value="visitors" className="mt-0 space-y-4">
									<div>
										<h3 className="text-slate-200 font-semibold text-base">Visitors Over Time</h3>
										<p className="text-slate-600 text-xs mt-0.5">Daily unique visitor count for the selected period</p>
									</div>
									<RechartsAreaChart
										data={chartData}
										dataKey="visitors"
										color="#34d399"
										height={260}
									/>
								</TabsContent>

								<TabsContent value="bounce" className="mt-0 space-y-4">
									<div>
										<h3 className="text-slate-200 font-semibold text-base">Bounce Rate</h3>
										<p className="text-slate-600 text-xs mt-0.5">Percentage of single-page sessions per day</p>
									</div>
									<RechartsAreaChart
										data={chartData}
										dataKey="bounce_rate"
										color="#ff9800"
										height={260}
										unit="%"
									/>
								</TabsContent>
							</div>
						</div>
					</Tabs>

					{/* Breakdowns */}
					<div className="space-y-6">
						{/* Section divider */}
						<div className="flex items-center gap-4">
							<div className="h-px flex-1 bg-[#1a1d2a]" />
							<span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-600">
								Traffic Breakdown
							</span>
							<div className="h-px flex-1 bg-[#1a1d2a]" />
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
