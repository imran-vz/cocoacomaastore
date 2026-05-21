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
					<Skeleton className="h-75 w-full" />
				</CardContent>
			</Card>
		);
	}

	const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
	const totalOrders = data.reduce((sum, d) => sum + d.orders, 0);

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
				<ChartContainer config={chartConfig} className="h-75 w-full">
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
										<div className="flex items-center justify-between gap-8">
											<span className="text-muted-foreground">{name === "revenue" ? "Revenue" : name}</span>
											<span className="font-mono font-medium">
												{name === "revenue" ? formatCurrency(value as number) : value}
											</span>
										</div>
									)}
								/>
							}
						/>
						<Bar yAxisId="revenue" dataKey="revenue" fill="#f2b38d" radius={[4, 4, 0, 0]} barSize={28} />
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
