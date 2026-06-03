"use client";

import type { ComponentProps } from "react";
import { useEffect, useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, XAxis, YAxis } from "recharts";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { cn, formatCurrency } from "@/lib/utils";
import type { PieChartRow, TrendChartRow } from "./analytics-content";

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

type DelayedChartTooltipContentProps = ComponentProps<typeof ChartTooltipContent> & {
	delayMs?: number;
};

function DelayedChartTooltipContent({
	active,
	label,
	delayMs = 430,
	className,
	...props
}: DelayedChartTooltipContentProps) {
	const [isVisible, setIsVisible] = useState(false);
	const tooltipIdentity = active ? String(label ?? "") : "__inactive__";

	useEffect(() => {
		setIsVisible(false);

		if (tooltipIdentity === "__inactive__") return;

		const timeout = window.setTimeout(() => {
			setIsVisible(true);
		}, delayMs);

		return () => window.clearTimeout(timeout);
	}, [delayMs, tooltipIdentity]);

	if (!active) return null;

	return (
		<ChartTooltipContent
			active={active}
			className={cn("transition-opacity duration-100", isVisible ? "opacity-100" : "opacity-0", className)}
			label={label}
			{...props}
		/>
	);
}

function toNumber(value: unknown): number {
	return typeof value === "number" ? value : Number(value ?? 0);
}

function formatChartValue(value: unknown, name: unknown) {
	const isRevenueMetric = String(name).toLowerCase() === "revenue";
	return isRevenueMetric ? formatCurrency(toNumber(value)) : toNumber(value);
}

export function TrendDesktopChart({
	rows,
	isWeeklyTrend,
	isTrendTransitioning,
	onMonthSelect,
}: {
	rows: TrendChartRow[];
	isWeeklyTrend: boolean;
	isTrendTransitioning: boolean;
	onMonthSelect: (month: string) => void;
}) {
	return (
		<div className="relative hidden md:block">
			<ChartContainer config={monthlyRevenueChartConfig} className="h-80 w-full transition-opacity md:flex">
				<ComposedChart data={rows} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
					<CartesianGrid strokeDasharray="3 8" vertical={false} stroke="var(--border)" strokeOpacity={0.75} />
					<XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={12} />
					<YAxis
						yAxisId="revenue"
						axisLine={false}
						tickLine={false}
						tickMargin={12}
						tickFormatter={(value) => (value >= 1000 ? `₹${(value / 1000).toFixed(0)}k` : `₹${value}`)}
						width={58}
					/>
					<YAxis yAxisId="orders" orientation="right" axisLine={false} tickLine={false} tickMargin={12} width={34} />
					<ChartTooltip
						content={
							<DelayedChartTooltipContent
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
						barSize={isWeeklyTrend ? 44 : 26}
						activeBar={false}
						animationDuration={750}
						animationEasing="ease-in-out"
						onClick={(entry: unknown) => {
							if (isWeeklyTrend) return;
							const monthKey = (entry as { payload?: { monthKey?: string } }).payload?.monthKey;
							if (monthKey && !isTrendTransitioning) onMonthSelect(monthKey);
						}}
					>
						{rows.map((entry) => (
							<Cell
								key={`trend-bar-${entry.key}`}
								cursor={
									!isWeeklyTrend && !isTrendTransitioning && entry.monthKey && entry.revenue !== null
										? "pointer"
										: "default"
								}
								fill="var(--color-revenue)"
								opacity={entry.revenue === null ? 0.28 : 1}
							/>
						))}
					</Bar>
					<Line
						yAxisId="orders"
						type="monotone"
						dataKey="orders"
						stroke="var(--color-orders)"
						strokeWidth={3}
						name="Orders"
						dot={isWeeklyTrend}
						animationDuration={650}
						animationEasing="ease-in-out"
						activeDot={{
							r: 4,
							strokeWidth: 2,
							stroke: "var(--background)",
							fill: "var(--color-orders)",
						}}
					/>
				</ComposedChart>
			</ChartContainer>
		</div>
	);
}

export function DessertRevenueDesktopPanel({
	rows,
	topDessertShare,
	total,
}: {
	rows: PieChartRow[];
	topDessertShare: number;
	total: number;
}) {
	return (
		<div className="hidden gap-6 md:grid xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.35fr)] xl:items-center">
			<div className="relative mx-auto aspect-square w-full max-w-96">
				<ChartContainer config={dessertRevenueChartConfig} className="h-full w-full">
					<PieChart>
						<Pie
							data={rows}
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
							{rows.map((entry) => (
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
												<div className="font-mono font-medium tabular-nums">{formatCurrency(toNumber(value))}</div>
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
							<div className="text-[0.68rem] font-medium uppercase text-muted-foreground tracking-normal">Total</div>
							<div className="text-lg font-semibold tabular-nums">{formatCurrency(total)}</div>
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
						<p className="mt-1 text-lg font-semibold tabular-nums">{rows.length}</p>
					</div>
					<div className="rounded-lg border bg-muted/35 px-3 py-2.5">
						<p className="text-xs font-medium text-muted-foreground">Top dessert</p>
						<p className="mt-1 truncate text-lg font-semibold">{rows[0]?.name}</p>
					</div>
				</div>
				<div className="grid gap-2 md:grid-cols-2">
					{rows.map((entry) => (
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
								<div className="text-right text-sm font-semibold tabular-nums">{formatCurrency(entry.value)}</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
