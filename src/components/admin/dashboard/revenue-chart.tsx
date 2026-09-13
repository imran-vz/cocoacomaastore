"use client";

import { TrendingUp } from "lucide-react";
import { lazy, useState } from "react";
import type { DailyRevenue } from "@/app/admin/dashboard/actions";
import { DesktopChartSlot } from "@/components/desktop-chart-slot";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

const DesktopRevenueChart = lazy(() => import("./revenue-desktop-chart"));

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
				<DesktopChartSlot fallbackClassName="hidden h-75 w-full md:block">
					<DesktopRevenueChart data={data} />
				</DesktopChartSlot>
			</CardContent>
		</Card>
	);
}
