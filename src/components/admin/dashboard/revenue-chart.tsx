import { TrendingUp } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import type { DailyRevenue } from "@/app/admin/dashboard/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

const chartConfig = {
	revenue: {
		label: "Revenue",
		color: "var(--chart-1)",
	},
	orders: {
		label: "Orders",
		color: "var(--chart-2)",
	},
} satisfies ChartConfig;

export default function RevenueChart({ data, isLoading }: { data: DailyRevenue[]; isLoading?: boolean }) {
	if (isLoading) {
		return (
			<Card className="col-span-4">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<TrendingUp className="size-5" />
						Revenue Trend
					</CardTitle>
					<CardDescription>Last 7 days revenue</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-3 md:hidden">
						{[1, 2, 3, 4].map((slot) => (
							<div key={slot} className="space-y-3 rounded-lg border bg-card px-3 py-3">
								<div className="flex items-center justify-between gap-3">
									<div className="space-y-2">
										<Skeleton className="h-4 w-16" />
										<Skeleton className="h-3 w-14" />
									</div>
									<Skeleton className="h-4 w-20" />
								</div>
								<Skeleton className="h-2 w-full rounded-full" />
							</div>
						))}
					</div>
					<Skeleton className="hidden h-75 w-full md:block" />
				</CardContent>
			</Card>
		);
	}

	const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
	const totalOrders = data.reduce((sum, d) => sum + d.orders, 0);
	const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);
	const bestDay = data.reduce((best, day) => (day.revenue > best.revenue ? day : best), data[0]);
	const formatChartMetric = (value: string | number | Array<string | number>, name: string | number) =>
		name === "revenue" ? formatCurrency(value as number) : value;

	return (
		<Card className="col-span-4">
			<CardHeader>
				<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
					<div>
						<CardTitle className="flex items-center gap-2">
							<TrendingUp className="size-5" />
							Revenue Trend
						</CardTitle>
						<CardDescription>Last 7 days revenue</CardDescription>
					</div>
					<div className="flex gap-4 text-sm">
						<div>
							<p className="text-muted-foreground">Total Revenue</p>
							<p className="font-semibold">{formatCurrency(totalRevenue)}</p>
						</div>
						<div>
							<p className="text-muted-foreground">Total Orders</p>
							<p className="font-semibold">{totalOrders}</p>
						</div>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-3 md:hidden">
					<div className="grid grid-cols-2 gap-2">
						<div className="rounded-lg border bg-muted/30 px-3 py-2.5">
							<p className="text-xs font-medium text-muted-foreground">Best day</p>
							<p className="mt-1 truncate text-base font-semibold">{bestDay?.date ?? "No data"}</p>
						</div>
						<div className="rounded-lg border bg-muted/30 px-3 py-2.5">
							<p className="text-xs font-medium text-muted-foreground">Days shown</p>
							<p className="mt-1 text-base font-semibold tabular-nums">{data.length}</p>
						</div>
					</div>
					<div className="space-y-2">
						{data.map((day) => {
							const percent = Math.max(8, Math.round((day.revenue / maxRevenue) * 100));

							return (
								<div key={day.date} className="rounded-lg border bg-card px-3 py-3">
									<div className="mb-2 flex items-center justify-between gap-3">
										<div className="min-w-0">
											<p className="truncate text-sm font-medium">{day.date}</p>
											<p className="text-xs text-muted-foreground tabular-nums">
												{day.orders} order{day.orders === 1 ? "" : "s"}
											</p>
										</div>
										<p className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(day.revenue)}</p>
									</div>
									<div className="h-2 overflow-hidden rounded-full bg-muted">
										<div className="h-full rounded-full bg-[#f2b38d]" style={{ width: `${percent}%` }} />
									</div>
								</div>
							);
						})}
					</div>
				</div>
				<ChartContainer config={chartConfig} className="hidden h-75 w-full md:flex">
					<ComposedChart accessibilityLayer data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
						<CartesianGrid strokeDasharray="3 8" vertical={false} />
						<XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={10} />
						<YAxis
							yAxisId="revenue"
							axisLine={false}
							tickLine={false}
							tickMargin={10}
							tickFormatter={(value) => (value >= 1000 ? `₹${(value / 1000).toFixed(0)}k` : `₹${value}`)}
							width={50}
						/>
						<YAxis yAxisId="orders" orientation="right" axisLine={false} tickLine={false} tickMargin={10} width={34} />
						<ChartTooltip
							content={
								<ChartTooltipContent
									formatter={(value, name) => (
										<div className="flex w-full items-center justify-between gap-8">
											<span className="text-muted-foreground">{name === "revenue" ? "Revenue" : "Orders"}</span>
											<span className="font-mono font-medium tabular-nums">{formatChartMetric(value, name)}</span>
										</div>
									)}
								/>
							}
						/>
						<Bar
							yAxisId="revenue"
							dataKey="revenue"
							fill="#f2b38d"
							radius={[4, 4, 0, 0]}
							barSize={28}
							activeBar={false}
						/>
						<Line
							yAxisId="orders"
							type="monotone"
							dataKey="orders"
							stroke="#12877f"
							strokeWidth={3}
							dot={false}
							activeDot={{
								r: 4,
								strokeWidth: 2,
								stroke: "var(--background)",
								fill: "#12877f",
							}}
						/>
					</ComposedChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
