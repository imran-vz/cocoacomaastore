"use client";

import { IconCalendar, IconChartBar, IconCookie, IconTrendingUp } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

type AnalyticsContentProps = {
	monthlyRevenue: MonthlyRevenue[];
	monthlyDessertRevenue: MonthlyDessertRevenue[];
	availableMonths: string[];
	initialMonth: string;
};

const COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
	"#2563eb", // blue-600
	"#db2777", // pink-600
	"#d97706", // amber-600
	"#9333ea", // purple-600
	"#059669", // emerald-600
	"#dc2626", // red-600
	"#ca8a04", // yellow-600
	"#0891b2", // cyan-600
	"#4f46e5", // indigo-600
	"#be185d", // rose-700
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

export function AnalyticsContent({
	monthlyRevenue: initialMonthlyRevenue,
	monthlyDessertRevenue: initialDessertRevenue,
	availableMonths,
	initialMonth,
}: AnalyticsContentProps) {
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

	// Calculate totals
	const totalRevenue = useMemo(
		() => initialMonthlyRevenue.reduce((sum, r) => sum + r.grossRevenue, 0),
		[initialMonthlyRevenue],
	);
	const totalOrders = useMemo(
		() => initialMonthlyRevenue.reduce((sum, r) => sum + r.orderCount, 0),
		[initialMonthlyRevenue],
	);
	const monthlyDessertTotal = useMemo(
		() => dessertRevenue.reduce((sum, d) => sum + d.grossRevenue, 0),
		[dessertRevenue],
	);

	const selectedMonthRevenue =
		initialMonthlyRevenue.find((r) => r.month === selectedMonth)?.grossRevenue ?? monthlyDessertTotal;

	// Prepare chart data for monthly revenue — show every month of the current
	// year on the x-axis. Months without real data get `null` so Recharts skips
	// them, making the line cut off at the last known value instead of
	// collapsing to zero for future months.
	const revenueByMonth = useMemo(
		() => new Map(initialMonthlyRevenue.map((r) => [r.month, r])),
		[initialMonthlyRevenue],
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

	// Prepare pie chart data for dessert revenue
	const pieChartData = useMemo(
		() =>
			dessertRevenue.slice(0, 8).map((d) => ({
				name: d.dessertName,
				value: d.grossRevenue,
			})),
		[dessertRevenue],
	);

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
						<p className="text-xs text-muted-foreground">Across {initialMonthlyRevenue.length} months</p>
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
					{initialMonthlyRevenue.length === 0 ? (
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

			{/* Per-Dessert Revenue Section */}
			<div className="grid gap-6 lg:grid-cols-2">
				{/* Dessert Revenue Table */}
				<Card className="lg:col-span-1">
					<CardHeader>
						<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
							<div>
								<CardTitle className="flex items-center gap-2">
									<IconCookie className="size-5" />
									Per-Dessert Revenue
								</CardTitle>
								<CardDescription>Revenue breakdown by dessert for selected month</CardDescription>
							</div>
							<Select value={selectedMonth} onValueChange={(value) => handleMonthChange(value || "")}>
								<SelectTrigger className="w-40">
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
						{isLoadingDesserts ? (
							<div className="space-y-2">
								{[1, 2, 3, 4, 5].map((i) => (
									<Skeleton key={i} className="h-12 w-full" />
								))}
							</div>
						) : dessertRevenue.length === 0 ? (
							<div className="h-64 flex items-center justify-center text-muted-foreground">
								No dessert revenue data for this month
							</div>
						) : (
							<div className="max-h-96 overflow-auto">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Dessert</TableHead>
											<TableHead className="text-right">Qty</TableHead>
											<TableHead className="text-right">Revenue</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{dessertRevenue.map((d, i) => (
											<TableRow key={d.dessertId}>
												<TableCell className="font-medium">
													<div className="flex items-center gap-2">
														<div
															className="size-3 rounded-full"
															style={{
																backgroundColor: COLORS[i % COLORS.length],
															}}
														/>
														{d.dessertName}
													</div>
												</TableCell>
												<TableCell className="text-right tabular-nums">{d.quantitySold}</TableCell>
												<TableCell className="text-right tabular-nums font-medium">
													{formatCurrency(d.grossRevenue)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Dessert Revenue Pie Chart */}
				<Card className="lg:col-span-1">
					<CardHeader>
						<CardTitle>Revenue Distribution</CardTitle>
						<CardDescription>Top 8 desserts by revenue</CardDescription>
					</CardHeader>
					<CardContent>
						{pieChartData.length === 0 ? (
							<div className="h-80 flex items-center justify-center text-muted-foreground">No data available</div>
						) : (
							<ChartContainer config={dessertRevenueChartConfig} className="h-80 w-full">
								<PieChart>
									<Pie
										data={pieChartData}
										cx="50%"
										cy="50%"
										innerRadius={60}
										outerRadius={100}
										paddingAngle={2}
										dataKey="value"
										label={({ name, percent }: { name?: string; percent?: number }) => {
											const label = name ?? "";
											const displayName = label.length > 10 ? `${label.slice(0, 10)}...` : label;
											return `${displayName} (${((percent ?? 0) * 100).toFixed(0)}%)`;
										}}
										labelLine={false}
									>
										{pieChartData.map((entry, index) => (
											<Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
										))}
									</Pie>
									<ChartTooltip
										shared={false}
										content={
											<ChartTooltipContent
												hideLabel
												nameKey="name"
												formatter={(value, name) => (
													<div className="flex w-full items-center justify-between gap-8">
														<span className="text-muted-foreground">{String(name)}</span>
														<span className="font-mono font-medium tabular-nums">
															{formatCurrency(toNumber(value))}
														</span>
													</div>
												)}
											/>
										}
									/>
								</PieChart>
							</ChartContainer>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
