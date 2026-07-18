"use client";

import { TrendingUp } from "lucide-react";
import { useState } from "react";
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
	const [selectedDate, setSelectedDate] = useState<string | null>(null);

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
						<div className="flex h-40 items-end gap-2">
							{[40, 65, 30, 85, 100, 90, 55].map((height, index) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton slots
								<div key={index} className="flex h-full flex-1 items-end justify-center">
									<Skeleton className="w-full max-w-[30px] rounded-t-md" style={{ height: `${height}%` }} />
								</div>
							))}
						</div>
						<div className="space-y-2 rounded-xl border bg-muted/30 px-4 py-3.5">
							<div className="flex items-center justify-between gap-3">
								<Skeleton className="h-4 w-16" />
								<Skeleton className="h-5 w-20" />
							</div>
							<Skeleton className="h-3 w-24" />
						</div>
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
	const selectedDay = data.find((day) => day.date === selectedDate) ?? bestDay;
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
				<div className="space-y-4 md:hidden">
					{selectedDay ? (
						<>
							<div className="flex h-40 items-end gap-2">
								{data.map((day) => {
									const isSelected = day.date === selectedDay.date;

									return (
										<button
											key={day.date}
											type="button"
											aria-pressed={isSelected}
											aria-label={`${day.date}, ${formatCurrency(day.revenue)}, ${day.orders} orders`}
											onClick={() => setSelectedDate(day.date)}
											className="flex h-full flex-1 flex-col items-center gap-2"
										>
											<div className="flex w-full flex-1 items-end justify-center">
												{day.revenue > 0 ? (
													<div
														className={`w-full max-w-[30px] rounded-t-md bg-[#f2b38d] transition-opacity ${isSelected ? "opacity-100" : "opacity-40"}`}
														style={{ height: `${Math.round((day.revenue / maxRevenue) * 100)}%` }}
													/>
												) : (
													<div
														className={`h-1.5 w-full max-w-[30px] rounded-full transition-colors ${isSelected ? "bg-muted-foreground/50" : "bg-muted"}`}
													/>
												)}
											</div>
											<span
												className={`text-[11px] font-semibold tabular-nums ${isSelected ? "text-foreground" : "text-muted-foreground"}`}
											>
												{day.date.split(" ")[0]}
											</span>
										</button>
									);
								})}
							</div>
							<div className="rounded-xl border bg-muted/30 px-4 py-3.5">
								<div className="flex items-baseline justify-between gap-3">
									<p className="text-sm font-semibold">{selectedDay.date}</p>
									<p className="text-lg font-bold tabular-nums text-[#c9702e] dark:text-[#f0a06a]">
										{formatCurrency(selectedDay.revenue)}
									</p>
								</div>
								<div className="mt-1 flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
									<p className="tabular-nums">
										{selectedDay.orders} order{selectedDay.orders === 1 ? "" : "s"}
									</p>
									{selectedDay.date === bestDay?.date && selectedDay.revenue > 0 ? (
										<p className="font-semibold text-[#12877f]">Best day</p>
									) : (
										<p className="tabular-nums">
											{selectedDay.revenue > 0
												? `${Math.round((selectedDay.revenue / totalRevenue) * 100)}% of week`
												: "no sales"}
										</p>
									)}
								</div>
							</div>
						</>
					) : (
						<p className="py-8 text-center text-sm text-muted-foreground">No revenue data yet</p>
					)}
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
