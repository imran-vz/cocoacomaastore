"use client";

import {
	IconCalendar,
	IconChartBar,
	IconCookie,
	IconPackage,
	IconTrendingUp,
} from "@tabler/icons-react";
import { useCallback, useState } from "react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Line,
	LineChart,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import {
	type DailyEodStock,
	getCachedMonthlyDessertRevenue,
	type MonthlyDessertRevenue,
	type MonthlyRevenue,
} from "@/app/admin/dashboard/actions";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";

type AnalyticsContentProps = {
	monthlyRevenue: MonthlyRevenue[];
	monthlyDessertRevenue: MonthlyDessertRevenue[];
	availableMonths: string[];
	initialMonth: string;
	eodStockTrends: DailyEodStock[];
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

function formatMonth(month: string): string {
	const [year, monthNum] = month.split("-");
	const date = new Date(Number(year), Number(monthNum) - 1);
	return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function formatShortDate(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function AnalyticsContent({
	monthlyRevenue: initialMonthlyRevenue,
	monthlyDessertRevenue: initialDessertRevenue,
	availableMonths,
	initialMonth,
	eodStockTrends,
}: AnalyticsContentProps) {
	const [selectedMonth, setSelectedMonth] = useState(initialMonth);
	const [dessertRevenue, setDessertRevenue] = useState(initialDessertRevenue);
	const [isLoadingDesserts, setIsLoadingDesserts] = useState(false);
	const [selectedDessert, setSelectedDessert] = useState<string | null>(null);

	const handleMonthChange = useCallback(async (month: string) => {
		setSelectedMonth(month);
		setIsLoadingDesserts(true);

		try {
			const data = await getCachedMonthlyDessertRevenue(month);
			setDessertRevenue(data);
		} catch (error) {
			console.error("Failed to fetch dessert revenue:", error);
		} finally {
			setIsLoadingDesserts(false);
		}
	}, []);

	// Calculate totals
	const totalRevenue = initialMonthlyRevenue.reduce(
		(sum, r) => sum + r.grossRevenue,
		0,
	);
	const totalOrders = initialMonthlyRevenue.reduce(
		(sum, r) => sum + r.orderCount,
		0,
	);
	const monthlyDessertTotal = dessertRevenue.reduce(
		(sum, d) => sum + d.grossRevenue,
		0,
	);

	const selectedMonthRevenue =
		initialMonthlyRevenue.find((r) => r.month === selectedMonth)
			?.grossRevenue ?? monthlyDessertTotal;

	// Prepare chart data for monthly revenue
	const monthlyChartData = initialMonthlyRevenue.map((r) => ({
		month: formatMonth(r.month),
		revenue: r.grossRevenue,
		orders: r.orderCount,
	}));

	// Prepare pie chart data for dessert revenue
	const pieChartData = dessertRevenue.slice(0, 8).map((d) => ({
		name: d.dessertName,
		value: d.grossRevenue,
	}));

	// Get unique desserts from EOD stock data
	const uniqueDesserts = Array.from(
		new Set(eodStockTrends.map((s) => s.dessertName)),
	);

	// Prepare EOD stock trend data (grouped by date)
	const stockTrendsByDate = eodStockTrends.reduce(
		(acc, item) => {
			const existing = acc.find((d) => d.day === item.day);
			if (existing) {
				existing[item.dessertName] = item.remainingStock;
				existing[`${item.dessertName}_initial`] = item.initialStock;
			} else {
				acc.push({
					day: item.day,
					date: formatShortDate(item.day),
					[item.dessertName]: item.remainingStock,
					[`${item.dessertName}_initial`]: item.initialStock,
				});
			}
			return acc;
		},
		[] as Record<string, string | number>[],
	);

	// Filter stock trends for selected dessert
	const filteredStockTrends = selectedDessert
		? eodStockTrends.filter((s) => s.dessertName === selectedDessert)
		: [];

	const singleDessertChartData = filteredStockTrends.map((s) => ({
		date: formatShortDate(s.day),
		initial: s.initialStock,
		remaining: s.remainingStock,
		sold: s.initialStock - s.remainingStock,
	}));

	return (
		<div className="flex-1 space-y-6">
			{/* Header */}
			<div>
				<h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
				<p className="text-muted-foreground">
					Revenue trends, dessert performance, and stock insights
				</p>
			</div>

			{/* Summary Stats */}
			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
						<IconTrendingUp className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{formatCurrency(totalRevenue)}
						</div>
						<p className="text-xs text-muted-foreground">
							Across {initialMonthlyRevenue.length} months
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Orders</CardTitle>
						<IconChartBar className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{totalOrders.toLocaleString()}
						</div>
						<p className="text-xs text-muted-foreground">
							Avg{" "}
							{totalOrders > 0
								? formatCurrency(totalRevenue / totalOrders)
								: "₹0"}{" "}
							per order
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							{formatMonth(selectedMonth)} Revenue
						</CardTitle>
						<IconCalendar className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{formatCurrency(selectedMonthRevenue)}
						</div>
						<p className="text-xs text-muted-foreground">
							From {dessertRevenue.length} desserts
						</p>
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
					{monthlyChartData.length === 0 ? (
						<div className="h-80 flex items-center justify-center text-muted-foreground">
							No monthly revenue data available yet. Data will appear after the
							analytics worker processes completed months.
						</div>
					) : (
						<ResponsiveContainer width="100%" height={320}>
							<AreaChart
								data={monthlyChartData}
								margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
							>
								<defs>
									<linearGradient
										id="revenueGradient"
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop
											offset="5%"
											stopColor="var(--chart-1)"
											stopOpacity={0.3}
										/>
										<stop
											offset="95%"
											stopColor="var(--chart-1)"
											stopOpacity={0}
										/>
									</linearGradient>
								</defs>
								<CartesianGrid strokeDasharray="3 3" vertical={false} />
								<XAxis
									dataKey="month"
									axisLine={false}
									tickLine={false}
									tickMargin={10}
								/>
								<YAxis
									yAxisId="revenue"
									axisLine={false}
									tickLine={false}
									tickMargin={10}
									tickFormatter={(value) =>
										value >= 1000
											? `₹${(value / 1000).toFixed(0)}k`
											: `₹${value}`
									}
									width={60}
								/>
								<YAxis
									yAxisId="orders"
									orientation="right"
									axisLine={false}
									tickLine={false}
									tickMargin={10}
									width={40}
								/>
								<Tooltip
									formatter={(value: number, name: string) => [
										name === "Revenue" ? formatCurrency(value) : value,
										name,
									]}
								/>
								<Legend />
								<Area
									yAxisId="revenue"
									type="monotone"
									dataKey="revenue"
									stroke="var(--chart-1)"
									strokeWidth={2}
									fill="url(#revenueGradient)"
									name="Revenue"
								/>
								<Line
									yAxisId="orders"
									type="monotone"
									dataKey="orders"
									stroke="var(--chart-2)"
									strokeWidth={2}
									dot={{ fill: "var(--chart-2)", r: 4 }}
									name="Orders"
								/>
							</AreaChart>
						</ResponsiveContainer>
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
								<CardDescription>
									Revenue breakdown by dessert for selected month
								</CardDescription>
							</div>
							<Select value={selectedMonth} onValueChange={handleMonthChange}>
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
												<TableCell className="text-right tabular-nums">
													{d.quantitySold}
												</TableCell>
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
							<div className="h-80 flex items-center justify-center text-muted-foreground">
								No data available
							</div>
						) : (
							<ResponsiveContainer width="100%" height={320}>
								<PieChart>
									<Pie
										data={pieChartData}
										cx="50%"
										cy="50%"
										innerRadius={60}
										outerRadius={100}
										paddingAngle={2}
										dataKey="value"
										label={({ name, percent }) =>
											`${name.length > 10 ? `${name.slice(0, 10)}...` : name} (${(percent * 100).toFixed(0)}%)`
										}
										labelLine={false}
									>
										{pieChartData.map((entry, index) => (
											<Cell
												key={entry.name}
												fill={COLORS[index % COLORS.length]}
											/>
										))}
									</Pie>
									<Tooltip
										formatter={(value: number) => formatCurrency(value)}
									/>
								</PieChart>
							</ResponsiveContainer>
						)}
					</CardContent>
				</Card>
			</div>

			{/* EOD Stock Trends */}
			<Card>
				<CardHeader>
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
						<div>
							<CardTitle className="flex items-center gap-2">
								<IconPackage className="size-5" />
								End-of-Day Stock Trends
							</CardTitle>
							<CardDescription>
								Daily leftover stock analysis (last 14 days)
							</CardDescription>
						</div>
						<Select
							value={selectedDessert || "all"}
							onValueChange={(v) => setSelectedDessert(v === "all" ? null : v)}
						>
							<SelectTrigger className="w-48">
								<SelectValue placeholder="Select dessert" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Desserts</SelectItem>
								{uniqueDesserts.map((dessert) => (
									<SelectItem key={dessert} value={dessert}>
										{dessert}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</CardHeader>
				<CardContent>
					<Tabs defaultValue="chart" className="w-full">
						<TabsList className="mb-4">
							<TabsTrigger value="chart">Chart</TabsTrigger>
							<TabsTrigger value="table">Table</TabsTrigger>
						</TabsList>

						<TabsContent value="chart">
							{eodStockTrends.length === 0 ? (
								<div className="h-80 flex items-center justify-center text-muted-foreground">
									No EOD stock data available yet. Data will appear after the
									analytics worker processes daily stock.
								</div>
							) : selectedDessert ? (
								<ResponsiveContainer width="100%" height={320}>
									<BarChart
										data={singleDessertChartData}
										margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
									>
										<CartesianGrid strokeDasharray="3 3" vertical={false} />
										<XAxis
											dataKey="date"
											axisLine={false}
											tickLine={false}
											tickMargin={10}
										/>
										<YAxis axisLine={false} tickLine={false} tickMargin={10} />
										<Tooltip />
										<Legend />
										<Bar
											dataKey="initial"
											name="Initial Stock"
											fill="var(--chart-1)"
											radius={[4, 4, 0, 0]}
										/>
										<Bar
											dataKey="remaining"
											name="Remaining"
											fill="var(--chart-2)"
											radius={[4, 4, 0, 0]}
										/>
									</BarChart>
								</ResponsiveContainer>
							) : (
								<ResponsiveContainer width="100%" height={320}>
									<LineChart
										data={stockTrendsByDate}
										margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
									>
										<CartesianGrid strokeDasharray="3 3" vertical={false} />
										<XAxis
											dataKey="date"
											axisLine={false}
											tickLine={false}
											tickMargin={10}
										/>
										<YAxis axisLine={false} tickLine={false} tickMargin={10} />
										<Tooltip />
										<Legend />
										{uniqueDesserts.slice(0, 6).map((dessert, i) => (
											<Line
												key={dessert}
												type="monotone"
												dataKey={dessert}
												stroke={COLORS[i % COLORS.length]}
												strokeWidth={2}
												dot={{ r: 3 }}
												name={dessert}
											/>
										))}
									</LineChart>
								</ResponsiveContainer>
							)}
						</TabsContent>

						<TabsContent value="table">
							{eodStockTrends.length === 0 ? (
								<div className="h-64 flex items-center justify-center text-muted-foreground">
									No EOD stock data available
								</div>
							) : (
								<div className="max-h-96 overflow-auto">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Date</TableHead>
												<TableHead>Dessert</TableHead>
												<TableHead className="text-right">Initial</TableHead>
												<TableHead className="text-right">Remaining</TableHead>
												<TableHead className="text-right">Sold</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{(selectedDessert
												? filteredStockTrends
												: eodStockTrends
											).map((s) => (
												<TableRow key={`${s.day}-${s.dessertId}`}>
													<TableCell>{formatShortDate(s.day)}</TableCell>
													<TableCell className="font-medium">
														{s.dessertName}
													</TableCell>
													<TableCell className="text-right tabular-nums">
														{s.initialStock}
													</TableCell>
													<TableCell className="text-right tabular-nums">
														{s.remainingStock}
													</TableCell>
													<TableCell className="text-right tabular-nums text-muted-foreground">
														{s.initialStock - s.remainingStock}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							)}
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>
		</div>
	);
}
