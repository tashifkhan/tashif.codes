import React, { useState, useEffect, useMemo, useCallback, memo, useRef, useLayoutEffect } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
	Legend,
	ResponsiveContainer,
} from "recharts";
import { useWebHaptics } from "web-haptics/react";

// --- Shared Tooltip Styles (avoid recreating objects on each render) ---
const TOOLTIP_STYLES = {
	contentStyle: {
		backgroundColor: "rgba(15, 23, 42, 0.95)",
		borderColor: "hsl(var(--primary) / 0.4)",
		borderRadius: "12px",
		borderWidth: "0px",
		color: "hsl(var(--foreground))",
		boxShadow: "0 10px 40px rgba(0, 0, 0, 0.4), 0 0 1px rgba(255, 255, 255, 0.1) inset",
		padding: "12px 16px",
	},
	itemStyle: {
		color: "hsl(var(--foreground))",
		fontSize: "13px",
		fontWeight: "500",
		lineHeight: "1.6",
	},
	labelStyle: {
		color: "hsl(var(--primary))",
		marginBottom: "8px",
		fontSize: "14px",
		fontWeight: "600",
		letterSpacing: "0.5px",
	},
} as const;

// --- Types ---

type TimeseriesEntry = {
	date: string; // ISO datetime string
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
	"oklch(0.7156 0.0605 248.6845)", // chart-1
	"oklch(0.7875 0.0917 35.9616)",  // chart-2
	"oklch(0.5778 0.0759 254.1573)", // chart-3
	"oklch(0.5016 0.0849 259.4902)", // chart-4
	"oklch(0.4241 0.0952 264.0306)", // chart-5
];

// Color conversion utility for SVG compatibility
const oklchToRgb = (oklchColor: string): string => {
	const oklchMap: { [key: string]: string } = {
		"oklch(0.7156 0.0605 248.6845)": "rgb(180, 190, 240)", // chart-1 - blue
		"oklch(0.7875 0.0917 35.9616)": "rgb(255, 200, 120)",  // chart-2 - orange
		"oklch(0.5778 0.0759 254.1573)": "rgb(160, 100, 220)", // chart-3 - purple
		"oklch(0.5016 0.0849 259.4902)": "rgb(130, 80, 200)",  // chart-4 - dark purple
		"oklch(0.4241 0.0952 264.0306)": "rgb(100, 50, 180)",  // chart-5 - darker purple
	};
	return oklchMap[oklchColor] || oklchColor;
};

// --- Helper Components ---

const GlassCard = memo(({
	className,
	children,
	...props
}: React.ComponentProps<typeof Card>) => (
	<Card
		className={cn(
			"border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 shadow-sm",
			className
		)}
		{...props}
	>
		{children}
	</Card>
));
GlassCard.displayName = "GlassCard";

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

	// Memoize formatted data to prevent recalculation on every render
	const formattedData = useMemo(() => {
		if (!data || data.length === 0) return [];

		// Use full data range to show strict period boundaries
		return data.map((d) => {
			const parsedDate = new Date(d.date);
			const safeDate = isNaN(parsedDate.getTime())
				? String(d.date).split("T")[0] // fallback if invalid date on mobile safari
				: parsedDate.toLocaleDateString(undefined, {
						month: "short",
						day: "numeric",
				  });

			return {
				...d,
				// Include the raw date for standard Recharts processing just in case
				rawDate: d.date,
				formattedDate: safeDate,
				displayValue:
					dataKey === "bounce_rate"
						? Math.round(d[dataKey] * 100) / 100
						: d[dataKey],
			};
		});
	}, [data, dataKey]);

	// Memoize tooltip formatter
	const tooltipFormatter = useCallback((value: number | undefined) => {
		const numValue = value ?? 0;
		return [
			`${numValue}${unit}`,
			dataKey.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
		];
	}, [dataKey, unit]);

	if (formattedData.length === 0)
		return (
			<div
				className="flex items-center justify-center text-muted-foreground text-sm"
				style={{ height }}
			>
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
					<CartesianGrid
						strokeDasharray="3 3"
						vertical={false}
						stroke="currentColor"
						opacity={0.1}
						className="text-muted-foreground"
					/>
					<XAxis
						dataKey="formattedDate"
						fontSize={12}
						tickLine={false}
						axisLine={false}
						stroke="currentColor"
						tick={{ fill: "currentColor" }}
						className="text-muted-foreground"
						interval="preserveStartEnd"
						minTickGap={20}
					/>
					<YAxis
						fontSize={12}
						tickLine={false}
						axisLine={false}
						tickFormatter={(value) => `${value.toLocaleString()}${unit}`}
						stroke="currentColor"
						tick={{ fill: "currentColor" }}
						className="text-muted-foreground"
						width={40}
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
						stroke={oklchToRgb(color)}
						fill={oklchToRgb(color)}
						fillOpacity={0.15}
						strokeWidth={2}
						connectNulls
						isAnimationActive={false}
					/>
				</AreaChart>
			) : (
				<div
					className="flex items-center justify-center text-muted-foreground text-sm"
					style={{ height }}
				>
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
	const chartData = useMemo(() =>
		data.slice(0, 5).map((item) => ({
			name: item.key,
			value: item.pageviews,
		})),
		[data]
	);

	// Memoize cell colors to prevent recreation
	const cells = useMemo(() =>
		chartData.map((_, index) => (
			<Cell
				key={index}
				fill={COLORS[index % COLORS.length]}
			/>
		)),
		[chartData]
	);

	if (chartData.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs">
				<Activity className="w-4 h-4 mb-1 opacity-20" />
				No data
			</div>
		);
	}

	return (
		<ResponsiveContainer width="100%" height={height}>
			<PieChart>
				<Pie
					data={chartData}
					cx="50%"
					cy="50%"
					innerRadius={60}
					outerRadius={80}
					paddingAngle={5}
					dataKey="value"
					isAnimationActive={false}
				>
					{cells}
				</Pie>
				<Tooltip
					contentStyle={TOOLTIP_STYLES.contentStyle}
					itemStyle={TOOLTIP_STYLES.itemStyle}
				/>
				<Legend
					verticalAlign="bottom"
					height={36}
					wrapperStyle={{ fontSize: "12px" }}
				/>
			</PieChart>
		</ResponsiveContainer>
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

	// Memoize bar cells
	const cells = useMemo(() =>
		chartData.map((_, index) => (
			<Cell key={index} fill={COLORS[index % COLORS.length]} />
		)),
		[chartData]
	);

	if (chartData.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs">
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
				<CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
				<XAxis type="number" hide />
				<YAxis
					dataKey="name"
					type="category"
					width={100}
					tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
					interval={0}
				/>
				<Tooltip
					cursor={{ fill: "hsl(var(--muted)/0.2)" }}
					contentStyle={TOOLTIP_STYLES.contentStyle}
					itemStyle={TOOLTIP_STYLES.itemStyle}
				/>
			<Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} isAnimationActive={false}>
				{cells}
				</Bar>
			</BarChart>
		</ResponsiveContainer>
	);
});
HorizontalBarChart.displayName = "HorizontalBarChart";

const MetricCard = memo(({
	title,
	value,
	icon: Icon,
	trend,
}: {
	title: string;
	value: string | number;
	icon: React.ComponentType<{ className?: string }>;
	trend?: string;
}) => (
	<GlassCard className="relative overflow-hidden hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300">
		<div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
		<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
			<CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
				{title}
			</CardTitle>
			<div className="p-2.5 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg border border-primary/20">
				<Icon className="h-5 w-5 text-primary" />
			</div>
		</CardHeader>
		<CardContent className="relative">
			<div className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent pb-0.5">{value}</div>
			{trend && (
				<p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
					<span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500/60"></span>
					{trend}
				</p>
			)}
		</CardContent>
	</GlassCard>
));
MetricCard.displayName = "MetricCard";

// Memoized progress bar to avoid motion recalculations
const ProgressBar = memo(({ value, maxVal, index }: { value: number; maxVal: number; index: number }) => (
	<div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
		<motion.div
			className="h-full bg-primary/80 group-hover:bg-primary transition-colors"
			initial={{ width: 0 }}
			animate={{ width: `${(value / maxVal) * 100}%` }}
			transition={{ duration: 0.5, delay: index * 0.05 }}
		/>
	</div>
));
ProgressBar.displayName = "ProgressBar";

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
	<GlassCard className="max-h-[300px] sm:max-h-[400px] md:h-[400px] flex flex-col hover:border-primary/20 transition-colors">
		<CardHeader className="pb-3 border-b border-border/40 bg-gradient-to-r from-transparent to-primary/5">
			<CardTitle className="text-sm font-medium uppercase tracking-wider flex items-center gap-2">
				{Icon && <Icon className="w-4 h-4 text-primary/60" />}
				{title}
			</CardTitle>
		</CardHeader>
		<CardContent className="space-y-3 flex-1 overflow-auto no-scrollbar p-4">
			{items.length === 0 ? (
				<div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs text-center">
					<Activity className="w-4 h-4 mb-1 opacity-20" />
					No data available
				</div>
			) : (
				items.map((item, i) => (
					<div key={item.key} className="group flex flex-col space-y-1.5 shrink-0 p-2 rounded-lg hover:bg-primary/5 transition-colors">
						<div className="flex justify-between text-xs sm:text-sm">
							<span
								className="truncate max-w-[70%] text-foreground/90 font-medium group-hover:text-primary transition-colors"
								title={item.key}
							>
								{item.key.replace(/^https?:\/\/[^/]+/, "") || "/"}
							</span>
							<span className="font-mono text-muted-foreground font-semibold">
								{item.pageviews.toLocaleString()}
							</span>
						</div>
						<ProgressBar value={item.pageviews} maxVal={maxVal} index={i} />
					</div>
				))
			)}
		</CardContent>
	</GlassCard>
));
BreakdownList.displayName = "BreakdownList";

const BreakdownChartCard = memo(({
	title,
	children,
	icon: Icon,
}: {
	title: string;
	children: React.ReactNode;
	icon?: React.ComponentType<{ className?: string }>;
}) => (
	<GlassCard className="h-[400px] flex flex-col hover:border-primary/20 transition-colors">
		<CardHeader className="pb-2 border-b border-border/40 bg-gradient-to-r from-transparent to-primary/5">
			<CardTitle className="text-sm font-medium uppercase tracking-wider text-foreground/80 flex items-center gap-2">
				{Icon && <Icon className="w-4 h-4 text-primary/60" />}
				{title}
			</CardTitle>
		</CardHeader>
		<CardContent className="flex-1 p-4 flex items-center justify-center">
			{children}
		</CardContent>
	</GlassCard>
));
BreakdownChartCard.displayName = "BreakdownChartCard";

// --- Main Dashboard Component ---

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

	// Get initial project from URL parameter - memoized
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

				// Check for URL parameter first
				const urlProject = getInitialProject();
				if (urlProject && data.projects.some((p) => p.slug === urlProject)) {
					setSelectedSlug(urlProject);
				} else if (data.projects.length > 0) {
					setSelectedSlug(data.projects[0].slug);
				}
			} catch (err) {
				if (err instanceof Error && err.name === 'AbortError') return;
				console.error(err);
				setError(
					"Could not load projects from " + API_BASE
				);
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

	// Derived metrics - memoized
	const totals = useMemo(() => {
		if (!stats) return { views: 0, visitors: 0, bounce: 0 };

		let views = 0;
		let visitors = 0;
		let bounceWeightedSum = 0;
		let totalPageviewsWithBounce = 0;

		// Single loop instead of multiple reduces
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

	// Memoize timeseries data for charts to prevent recalculation
	const chartData = useMemo(() => {
		if (!stats) return [];
		// API already filters by period, so use data as-is
		return stats.timeseries;
	}, [stats]);

	// Memoize max values for breakdown lists
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

	if (projects.length === 0 && !error) {
		return (
			<div className="flex flex-col items-center justify-center py-20 space-y-4">
				<div className="relative w-12 h-12">
					<div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
					<div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
				</div>
				<p className="text-muted-foreground animate-pulse">
					Connecting to internal analytics...
				</p>
			</div>
		);
	}

	return (
		<div className="w-full max-w-7xl mx-auto space-y-6 md:space-y-8 pb-10">
			{/* Project & Period Controls */}
			<div className="flex flex-col sm:flex-row gap-3 w-full">
				<Select
					value={selectedSlug}
					onValueChange={(v) => {
						trigger("selection");
						setLoading(true);
						setSelectedSlug(v);
					}}
				>
					<SelectTrigger className="w-full sm:w-[240px] bg-background/50 border-border/60 hover:border-border/80 focus:ring-primary/20 ring-offset-0 transition-colors">
						<SelectValue placeholder="Select Project" />
					</SelectTrigger>
					<SelectContent>
						{projects.map((p) => (
							<SelectItem
								key={p.slug}
								value={p.slug}
								className="cursor-pointer"
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
					<SelectTrigger className="w-full sm:w-[160px] bg-background/50 border-border/60 hover:border-border/80 focus:ring-primary/20 ring-offset-0 transition-colors">
						<Calendar className="w-4 h-4 mr-2 text-primary" />
						<SelectValue placeholder="Period" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="7">Last 7 days</SelectItem>
						<SelectItem value="30">Last 30 days</SelectItem>
						<SelectItem value="90">Last 90 days</SelectItem>
						<SelectItem value="365">Last 365 days</SelectItem>
						<SelectItem value="0">Lifetime</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{error ? (
				<GlassCard className="border-destructive/30 bg-destructive/5">
					<CardHeader>
						<CardTitle className="text-destructive flex items-center gap-2">
							<Activity className="w-5 h-5" />
							Connection Error
						</CardTitle>
						<CardDescription className="text-destructive/80">
							{error}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="p-4 bg-background/50 rounded-lg text-sm font-mono border border-border/50">
							Troubleshooting:
							<ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
								<li>Ensure the Python API is running on port 8000</li>
								<li>
									Check if{" "}
									<code className="bg-muted px-1 rounded">api/main.py</code> is
									executing without errors
								</li>
								<li>Verify network connectivity</li>
							</ul>
						</div>
					</CardContent>
				</GlassCard>
			) : loading || !stats ? (
				<div className="space-y-6">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						{[1, 2, 3].map((i) => (
							<div
								key={i}
								className="h-32 rounded-xl bg-muted/40 animate-pulse border border-border/30"
							/>
						))}
					</div>
					<div className="h-[400px] rounded-xl bg-muted/40 animate-pulse border border-border/30" />
				</div>
			) : (
				<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
					{/* Summary Cards */}
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
						<MetricCard
							title="Total Pageviews"
							value={totals.views.toLocaleString()}
							icon={Eye}
							trend={period === "0" ? "Lifetime" : `Last ${period} days`}
						/>
						<MetricCard
							title="Total Visitors"
							value={totals.visitors.toLocaleString()}
							icon={Users}
							trend={`Unique sessions`}
						/>
						<MetricCard
							title="Avg. Bounce Rate"
							value={`${totals.bounce.toFixed(1)}%`}
							icon={Activity}
							trend={`Average`}
						/>
					</div>

					{/* Main Chart Area */}
					<Tabs defaultValue="traffic" className="w-full" onValueChange={() => trigger("selection")}>
						<div className="flex items-center justify-between mb-4 px-1">
							<TabsList className="bg-muted/50 p-1 border border-border/20">
								<TabsTrigger
									value="traffic"
									className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
								>
									Traffic
								</TabsTrigger>
								<TabsTrigger
									value="visitors"
									className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
								>
									Visitors
								</TabsTrigger>
								<TabsTrigger
									value="bounce"
									className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
								>
									Bounce Rate
								</TabsTrigger>
							</TabsList>
						</div>

						<GlassCard className="p-1">
							<CardContent className="p-4 sm:p-6">
								<TabsContent value="traffic" className="mt-0 space-y-4">
									<div className="flex items-center justify-between">
										<div>
											<h3 className="text-lg font-semibold tracking-tight">
												Pageviews Over Time
											</h3>
											<p className="text-sm text-muted-foreground">
												Daily pageviews for the selected period
											</p>
										</div>
										<div className="bg-primary/10 text-primary text-xs font-medium px-2.5 py-0.5 rounded-full hidden sm:block">
											{period === "0" ? "Lifetime" : `${period} Day Trend`}
										</div>
									</div>
									<div className="w-full pt-4">
										<RechartsAreaChart
											data={chartData}
											dataKey="pageviews"
											color="oklch(0.7156 0.0605 248.6845)"
											height={280}
										/>
									</div>
								</TabsContent>

								<TabsContent value="visitors" className="mt-0 space-y-4">
									<div className="flex items-center justify-between">
										<div>
											<h3 className="text-lg font-semibold tracking-tight">
												Visitors Over Time
											</h3>
											<p className="text-sm text-muted-foreground">
												Daily unique visitors for the selected period
											</p>
										</div>
										<div className="bg-emerald-500/10 text-emerald-600 text-xs font-medium px-2.5 py-0.5 rounded-full hidden sm:block">
											{period === "0" ? "Lifetime" : `${period} Day Trend`}
										</div>
									</div>
									<div className="w-full pt-4">
										<RechartsAreaChart
											data={chartData}
											dataKey="visitors"
											color="oklch(0.7875 0.0917 35.9616)"
											height={280}
										/>
									</div>
								</TabsContent>

								<TabsContent value="bounce" className="mt-0 space-y-4">
									<div className="flex items-center justify-between">
										<div>
											<h3 className="text-lg font-semibold tracking-tight">
												Bounce Rate
											</h3>
											<p className="text-sm text-muted-foreground">
												Percentage of single-page sessions
											</p>
										</div>
										<div className="bg-red-500/10 text-red-600 text-xs font-medium px-2.5 py-0.5 rounded-full hidden sm:block">
											{period === "0" ? "Lifetime" : `${period} Day Trend`}
										</div>
									</div>
									<div className="w-full pt-4">
										<RechartsAreaChart
											data={chartData}
											dataKey="bounce_rate"
											color="oklch(0.5778 0.0759 254.1573)"
											height={280}
											unit="%"
										/>
									</div>
								</TabsContent>
							</CardContent>
						</GlassCard>
					</Tabs>

					{/* Breakdowns Grid */}
					<div className="space-y-6">
						<div>
							<h2 className="text-xl font-semibold tracking-tight mb-4">Traffic Breakdown</h2>
							<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
								{/* Top Paths - List */}
								<BreakdownList
									title="Top Paths"
									items={stats.stats.path}
									maxVal={maxPathPageviews}
									icon={Eye}
								/>

								{/* Top Referrers - List */}
								<BreakdownList
									title="Top Referrers"
									items={stats.stats.referrer}
									maxVal={maxReferrerPageviews}
									icon={Globe}
								/>

								{/* Top Countries - List */}
								<BreakdownList
									title="Top Countries"
									items={stats.stats.country}
									maxVal={maxCountryPageviews}
									icon={Globe}
								/>
							</div>
						</div>

						{/* Device & OS Charts */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							{/* Device Types - Donut Chart */}
							{stats.stats.device_type.length > 0 && (
								<BreakdownChartCard title="Device Types" icon={Smartphone}>
									<DonutChart data={stats.stats.device_type} title="Device Types" />
								</BreakdownChartCard>
							)}

							{/* Operating Systems - Donut Chart */}
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
