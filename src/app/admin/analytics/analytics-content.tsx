"use client";

import { IconCalendar, IconChartBar, IconTrendingUp } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { use, useCallback, useMemo, useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, XAxis, YAxis } from "recharts";
import type { MonthlyDessertRevenue, MonthlyRevenue } from "@/app/admin/dashboard/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";

type AnalyticsContentProps = {
	monthlyRevenue: Promise<MonthlyRevenue[]>;
	monthlyDessertRevenue: Promise<MonthlyDessertRevenue[]>;
	availableMonths: Promise<string[]>;
	initialMonth: Promise<string>;
};

type AnalyticsOverview = {
	monthlyRevenue: MonthlyRevenue[];
	availableMonths: string[];
	initialMonth: string;
};

const COLORS = [
	"oklch(0.56 0.07 34)",
	"oklch(0.58 0.09 183)",
	"oklch(0.46 0.06 225)",
	"oklch(0.73 0.13 82)",
	"oklch(0.69 0.13 67)",
	"oklch(0.55 0.11 262)",
	"oklch(0.58 0.11 345)",
	"oklch(0.56 0.08 136)",
	"oklch(0.54 0.08 302)",
	"oklch(0.57 0.1 25)",
];

const monthlyRevenueChartConfig = {
	revenue: {
		label: "Revenue",
		color: "#f2b38d",
	},
	orders: {
		label: "Orders",
		color: "#12877f",
	},
} satisfies ChartConfig;

const dessertRevenueChartConfig = {
	value: {
		label: "Revenue",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

function formatMonth(month: string): string {
	const [year, monthNum] = month.split("-");
	const date = new Date(Number(year), Number(monthNum) - 1);
	return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function toNumber(value: unknown): number {
	return typeof value === "number" ? value : Number(value ?? 0);
}

function formatChartValue(value: unknown, name: unknown) {
	const metricName = String(name);
	return metricName === "Revenue" || metricName === "revenue" ? formatCurrency(toNumber(value)) : toNumber(value);
}

async function fetchMonthlyDessertRevenue(month: string, signal?: AbortSignal): Promise<MonthlyDessertRevenue[]> {
	const response = await fetch(`/api/admin/analytics/monthly-dessert-revenue?month=${encodeURIComponent(month)}`, {
		cache: "no-store",
		signal,
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch monthly dessert revenue (${response.status})`);
	}

	return response.json();
}

async function fetchAnalyticsOverview(signal?: AbortSignal): Promise<AnalyticsOverview> {
	const response = await fetch("/api/admin/analytics/overview", {
		cache: "no-store",
		signal,
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch analytics overview (${response.status})`);
	}

	return response.json();
}

export function AnalyticsContent({
	monthlyRevenue,
	monthlyDessertRevenue,
	availableMonths: availableMonthsPromise,
	initialMonth: initialMonthPromise,
}: AnalyticsContentProps) {
	const initialMonthlyRevenue = use(monthlyRevenue);
	const initialDessertRevenue = use(monthlyDessertRevenue);
	const initialAvailableMonths = use(availableMonthsPromise);
	const initialMonth = use(initialMonthPromise);
	const initialOverview = useMemo(
		() => ({
			monthlyRevenue: initialMonthlyRevenue,
			availableMonths: initialAvailableMonths,
			initialMonth,
		}),
		[initialAvailableMonths, initialMonth, initialMonthlyRevenue],
	);
	const { data: overview, error: overviewError } = useQuery({
		queryKey: ["admin-analytics", "overview"],
		queryFn: ({ signal }) => fetchAnalyticsOverview(signal),
		initialData: initialOverview,
		staleTime: 60 * 60 * 1000,
		gcTime: 2 * 60 * 60 * 1000,
	});
	const [selectedMonth, setSelectedMonth] = useState(initialMonth);
	const {
		data: dessertRevenue = [],
		error: dessertRevenueError,
		isFetching: isLoadingDesserts,
	} = useQuery({
		queryKey: ["admin-analytics", "monthly-dessert-revenue", selectedMonth],
		queryFn: ({ signal }) => fetchMonthlyDessertRevenue(selectedMonth, signal),
		initialData: selectedMonth === initialMonth ? initialDessertRevenue : undefined,
		placeholderData: (previousData) => previousData,
		staleTime: 60 * 60 * 1000,
		gcTime: 2 * 60 * 60 * 1000,
	});
	const handleMonthChange = useCallback((month: string) => {
		setSelectedMonth(month);
	}, []);

	if (dessertRevenueError) {
		console.error("Failed to fetch dessert revenue:", dessertRevenueError);
	}
	if (overviewError) {
		console.error("Failed to fetch analytics overview:", overviewError);
	}

	const availableMonths = overview.availableMonths;
	const overviewMonthlyRevenue = overview.monthlyRevenue;

	// Calculate totals
	const totalRevenue = useMemo(
		() => overviewMonthlyRevenue.reduce((sum, r) => sum + r.grossRevenue, 0),
		[overviewMonthlyRevenue],
	);
	const totalOrders = useMemo(
		() => overviewMonthlyRevenue.reduce((sum, r) => sum + r.orderCount, 0),
		[overviewMonthlyRevenue],
	);
	const monthlyDessertTotal = useMemo(
		() => dessertRevenue.reduce((sum, d) => sum + d.grossRevenue, 0),
		[dessertRevenue],
	);

	const selectedMonthRevenue =
		overviewMonthlyRevenue.find((r) => r.month === selectedMonth)?.grossRevenue ?? monthlyDessertTotal;

	// Prepare chart data for monthly revenue — show every month of the current
	// year on the x-axis. Months without real data get `null` so Recharts skips
	// them, making the line cut off at the last known value instead of
	// collapsing to zero for future months.
	const revenueByMonth = useMemo(
		() => new Map(overviewMonthlyRevenue.map((r) => [r.month, r])),
		[overviewMonthlyRevenue],
	);
	const currentYear = new Date().getFullYear();
	const monthlyChartData = useMemo(
		() =>
			Array.from({ length: 12 }, (_, i) => {
				const monthKey = `${currentYear}-${String(i + 1).padStart(2, "0")}`;
				const data = revenueByMonth.get(monthKey);
				return {
					month: formatMonth(monthKey),
					revenue: data?.grossRevenue ?? null,
					orders: data?.orderCount ?? null,
				};
			}),
		[currentYear, revenueByMonth],
	);

	// Prepare donut chart data for dessert revenue
	const pieChartData = useMemo(() => {
		const total = dessertRevenue.slice(0, 8).reduce((sum, d) => sum + d.grossRevenue, 0);

		return dessertRevenue.slice(0, 8).map((d, index) => ({
			name: d.dessertName,
			value: d.grossRevenue,
			percent: total > 0 ? d.grossRevenue / total : 0,
			fill: COLORS[index % COLORS.length],
		}));
	}, [dessertRevenue]);
	const topDessertShare = pieChartData[0]?.percent ?? 0;

	return (
		<div className="flex-1 space-y-6">
			{/* Header */}
			<div>
				<h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
				<p className="text-muted-foreground">Revenue trends, dessert performance, and stock insights</p>
			</div>

			{/* Summary Stats */}
			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
						<IconTrendingUp className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
						<p className="text-xs text-muted-foreground">Across {overviewMonthlyRevenue.length} months</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Orders</CardTitle>
						<IconChartBar className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{totalOrders.toLocaleString()}</div>
						<p className="text-xs text-muted-foreground">
							Avg {totalOrders > 0 ? formatCurrency(totalRevenue / totalOrders) : "₹0"} per order
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">{formatMonth(selectedMonth)} Revenue</CardTitle>
						<IconCalendar className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{formatCurrency(selectedMonthRevenue)}</div>
						<p className="text-xs text-muted-foreground">From {dessertRevenue.length} desserts</p>
					</CardContent>
				</Card>
			</div>

			{/* Monthly Revenue Chart */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<IconTrendingUp className="size-5" />
						Monthly Revenue Trend
					</CardTitle>
					<CardDescription>Revenue and order count by month</CardDescription>
				</CardHeader>
				<CardContent>
					{overviewMonthlyRevenue.length === 0 ? (
						<div className="h-80 flex items-center justify-center text-muted-foreground">
							No monthly revenue data available yet. Data will appear after the analytics worker processes completed
							months.
						</div>
					) : (
						<ChartContainer config={monthlyRevenueChartConfig} className="h-80 w-full">
							<ComposedChart data={monthlyChartData} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
								<CartesianGrid strokeDasharray="3 8" vertical={false} stroke="var(--border)" strokeOpacity={0.75} />
								<XAxis dataKey="month" axisLine={false} tickLine={false} tickMargin={12} />
								<YAxis
									yAxisId="revenue"
									axisLine={false}
									tickLine={false}
									tickMargin={12}
									tickFormatter={(value) => (value >= 1000 ? `₹${(value / 1000).toFixed(0)}k` : `₹${value}`)}
									width={58}
								/>
								<YAxis
									yAxisId="orders"
									orientation="right"
									axisLine={false}
									tickLine={false}
									tickMargin={12}
									width={34}
								/>
								<ChartTooltip
									content={
										<ChartTooltipContent
											formatter={(value, name) => (
												<div className="flex w-full items-center justify-between gap-8">
													<span className="text-muted-foreground">{String(name)}</span>
													<span className="font-mono font-medium tabular-nums">{formatChartValue(value, name)}</span>
												</div>
											)}
										/>
									}
								/>
								<ChartLegend content={<ChartLegendContent />} />
								<Bar
									yAxisId="revenue"
									dataKey="revenue"
									fill="var(--color-revenue)"
									name="Revenue"
									radius={[4, 4, 0, 0]}
									barSize={26}
								/>
								<Line
									yAxisId="orders"
									type="monotone"
									dataKey="orders"
									stroke="var(--color-orders)"
									strokeWidth={3}
									name="Orders"
									dot={false}
									activeDot={{
										r: 4,
										strokeWidth: 2,
										stroke: "var(--background)",
										fill: "var(--color-orders)",
									}}
								/>
							</ComposedChart>
						</ChartContainer>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
						<div>
							<CardTitle>Revenue Distribution</CardTitle>
							<CardDescription>Top 8 desserts by revenue in {formatMonth(selectedMonth)}</CardDescription>
						</div>
						<Select value={selectedMonth} onValueChange={(value) => handleMonthChange(value || "")}>
							<SelectTrigger className="w-full sm:w-40">
								<SelectValue placeholder="Select month" />
							</SelectTrigger>
							<SelectContent>
								{availableMonths.map((month) => (
									<SelectItem key={month} value={month}>
										{formatMonth(month)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</CardHeader>
				<CardContent>
					{pieChartData.length === 0 ? (
						<div className="flex h-96 items-center justify-center text-muted-foreground">
							No dessert revenue data for this month
						</div>
					) : (
						<div
							className={`grid gap-6 transition-opacity xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.35fr)] xl:items-center ${
								isLoadingDesserts ? "opacity-70" : "opacity-100"
							}`}
						>
							<div className="relative mx-auto aspect-square w-full max-w-96">
								<ChartContainer config={dessertRevenueChartConfig} className="h-full w-full">
									<PieChart>
										<Pie
											data={pieChartData}
											cx="50%"
											cy="50%"
											innerRadius="62%"
											outerRadius="84%"
											cornerRadius={12}
											paddingAngle={3}
											dataKey="value"
											stroke="var(--card)"
											strokeWidth={3}
										>
											{pieChartData.map((entry) => (
												<Cell key={entry.name} fill={entry.fill} />
											))}
										</Pie>
										<ChartTooltip
											shared={false}
											wrapperStyle={{ zIndex: 30 }}
											content={
												<ChartTooltipContent
													hideLabel
													nameKey="name"
													formatter={(value, name, item) => (
														<div className="flex w-full items-center justify-between gap-8">
															<span className="text-muted-foreground">{String(name)}</span>
															<div className="text-right">
																<div className="font-mono font-medium tabular-nums">
																	{formatCurrency(toNumber(value))}
																</div>
																<div className="text-[0.7rem] text-muted-foreground">
																	{((Number(item.payload?.percent) || 0) * 100).toFixed(1)}%
																</div>
															</div>
														</div>
													)}
												/>
											}
										/>
									</PieChart>
								</ChartContainer>
								<div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
									<div className="grid size-32 place-items-center rounded-full border bg-card/95 shadow-sm ring-8 ring-background/70">
										<div className="text-center">
											<div className="text-[0.68rem] font-medium uppercase text-muted-foreground tracking-normal">
												Total
											</div>
											<div className="text-lg font-semibold tabular-nums">{formatCurrency(monthlyDessertTotal)}</div>
										</div>
									</div>
								</div>
							</div>
							<div className="space-y-3">
								<div className="grid gap-3 sm:grid-cols-3">
									<div className="rounded-lg border bg-muted/35 px-3 py-2.5">
										<p className="text-xs font-medium text-muted-foreground">Largest share</p>
										<p className="mt-1 text-lg font-semibold tabular-nums">{(topDessertShare * 100).toFixed(0)}%</p>
									</div>
									<div className="rounded-lg border bg-muted/35 px-3 py-2.5">
										<p className="text-xs font-medium text-muted-foreground">Desserts shown</p>
										<p className="mt-1 text-lg font-semibold tabular-nums">{pieChartData.length}</p>
									</div>
									<div className="rounded-lg border bg-muted/35 px-3 py-2.5">
										<p className="text-xs font-medium text-muted-foreground">Top dessert</p>
										<p className="mt-1 truncate text-lg font-semibold">{pieChartData[0]?.name}</p>
									</div>
								</div>
								<div className="grid gap-2 md:grid-cols-2">
									{pieChartData.map((entry) => (
										<div
											key={entry.name}
											className="group rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-muted/40"
										>
											<div className="flex items-center gap-3">
												<span
													className="h-9 w-1.5 shrink-0 rounded-full"
													style={{ backgroundColor: entry.fill }}
													aria-hidden="true"
												/>
												<div className="min-w-0 flex-1">
													<div className="truncate text-sm font-medium">{entry.name}</div>
													<div className="text-xs text-muted-foreground tabular-nums">
														{(entry.percent * 100).toFixed(0)}% of top desserts
													</div>
												</div>
												<div className="text-right text-sm font-semibold tabular-nums">
													{formatCurrency(entry.value)}
												</div>
											</div>
										</div>
									))}
								</div>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
