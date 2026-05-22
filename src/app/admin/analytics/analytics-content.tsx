"use client";

import { IconCalendar, IconChartBar, IconLoader2, IconTrendingUp, IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, XAxis, YAxis } from "recharts";
import type { MonthlyDessertRevenue, MonthlyRevenue, WeeklyRevenue } from "@/app/admin/dashboard/actions";
import { Button } from "@/components/ui/button";
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
import { cn, formatCurrency } from "@/lib/utils";

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

type MonthlyChartRow = {
	month: string;
	monthKey: string;
	revenue: number | null;
	orders: number | null;
};

type TrendChartRow = {
	key: string;
	label: string;
	subtitle: string;
	revenue: number | null;
	orders: number | null;
	monthKey?: string;
};

type PieChartRow = {
	name: string;
	value: number;
	percent: number;
	fill: string;
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

async function fetchWeeklyRevenue(month: string, signal?: AbortSignal): Promise<WeeklyRevenue[]> {
	const response = await fetch(`/api/admin/analytics/weekly-revenue?month=${encodeURIComponent(month)}`, {
		cache: "no-store",
		signal,
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch weekly revenue (${response.status})`);
	}

	return response.json();
}

function buildMonthlyChartData(monthlyRevenue: MonthlyRevenue[], currentYear: number): MonthlyChartRow[] {
	const revenueByMonth = new Map(monthlyRevenue.map((row) => [row.month, row]));

	return Array.from({ length: 12 }, (_, index) => {
		const monthKey = `${currentYear}-${String(index + 1).padStart(2, "0")}`;
		const row = revenueByMonth.get(monthKey);

		return {
			month: formatMonth(monthKey),
			monthKey,
			revenue: row?.grossRevenue ?? null,
			orders: row?.orderCount ?? null,
		};
	});
}

function buildPieChartData(dessertRevenue: MonthlyDessertRevenue[]): PieChartRow[] {
	const topDesserts = dessertRevenue.slice(0, 8);
	const total = topDesserts.reduce((sum, dessert) => sum + dessert.grossRevenue, 0);

	return topDesserts.map((dessert, index) => ({
		name: dessert.dessertName,
		value: dessert.grossRevenue,
		percent: total > 0 ? dessert.grossRevenue / total : 0,
		fill: COLORS[index % COLORS.length],
	}));
}

function SummaryCards({
	totalRevenue,
	totalOrders,
	month,
	selectedMonthRevenue,
	dessertCount,
	monthCount,
}: {
	totalRevenue: number;
	totalOrders: number;
	month: string;
	selectedMonthRevenue: number;
	dessertCount: number;
	monthCount: number;
}) {
	return (
		<div className="grid gap-4 md:grid-cols-3">
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
					<IconTrendingUp className="size-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
					<p className="text-xs text-muted-foreground">Across {monthCount} months</p>
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
					<CardTitle className="text-sm font-medium">{formatMonth(month)} Revenue</CardTitle>
					<IconCalendar className="size-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">{formatCurrency(selectedMonthRevenue)}</div>
					<p className="text-xs text-muted-foreground">From {dessertCount} desserts</p>
				</CardContent>
			</Card>
		</div>
	);
}

function isTrendRowDrillable({
	isTrendTransitioning,
	isWeeklyTrend,
	row,
}: {
	isTrendTransitioning: boolean;
	isWeeklyTrend: boolean;
	row: TrendChartRow;
}) {
	return !isWeeklyTrend && !isTrendTransitioning && !!row.monthKey && row.revenue !== null;
}

function getTrendMobileRowClass(isSelected: boolean, canDrillIn: boolean) {
	if (isSelected) return "border-primary/50 bg-primary/5";
	if (canDrillIn) return "hover:bg-muted/40";
	return "cursor-default";
}

function TrendMobileRow({
	row,
	maxRevenue,
	isWeeklyTrend,
	isTrendTransitioning,
	selectedTrendMonth,
	onMonthSelect,
}: {
	row: TrendChartRow;
	maxRevenue: number;
	isWeeklyTrend: boolean;
	isTrendTransitioning: boolean;
	selectedTrendMonth: string | null;
	onMonthSelect: (month: string) => void;
}) {
	const revenue = Number(row.revenue ?? 0);
	const percent = Math.max(8, Math.round((revenue / maxRevenue) * 100));
	const isSelected = row.monthKey === selectedTrendMonth;
	const canDrillIn = isTrendRowDrillable({ isTrendTransitioning, isWeeklyTrend, row });
	const rowClass = getTrendMobileRowClass(isSelected, canDrillIn);

	return (
		<button
			type="button"
			onClick={canDrillIn ? () => onMonthSelect(row.monthKey ?? "") : undefined}
			disabled={!canDrillIn}
			className={`w-full rounded-lg border bg-card px-3 py-3 text-left transition-colors ${rowClass}`}
		>
			<div className="mb-2 flex items-center justify-between gap-3">
				<div className="min-w-0">
					<p className="truncate text-sm font-medium">{row.label}</p>
					<p className="text-xs text-muted-foreground tabular-nums">{row.subtitle}</p>
				</div>
				<p className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(revenue)}</p>
			</div>
			<div className="h-2 overflow-hidden rounded-full bg-muted">
				<div className="h-full rounded-full bg-[#f2b38d]" style={{ width: `${percent}%` }} />
			</div>
		</button>
	);
}

function TrendMobileRows({
	rows,
	bestRow,
	maxRevenue,
	isWeeklyTrend,
	isTrendTransitioning,
	selectedTrendMonth,
	onMonthSelect,
}: {
	rows: TrendChartRow[];
	bestRow: TrendChartRow | null;
	maxRevenue: number;
	isWeeklyTrend: boolean;
	isTrendTransitioning: boolean;
	selectedTrendMonth: string | null;
	onMonthSelect: (month: string) => void;
}) {
	return (
		<div className="relative space-y-3 transition-opacity md:hidden">
			<div className="grid grid-cols-2 gap-2">
				<div className="rounded-lg border bg-muted/30 px-3 py-2.5">
					<p className="text-xs font-medium text-muted-foreground">Best {isWeeklyTrend ? "week" : "month"}</p>
					<p className="mt-1 truncate text-base font-semibold">{bestRow?.label ?? "No data"}</p>
				</div>
				<div className="rounded-lg border bg-muted/30 px-3 py-2.5">
					<p className="text-xs font-medium text-muted-foreground">{isWeeklyTrend ? "Weeks" : "Months"} shown</p>
					<p className="mt-1 text-base font-semibold tabular-nums">{rows.length}</p>
				</div>
			</div>
			<div className="space-y-2">
				{rows.map((row) => (
					<TrendMobileRow
						key={row.key}
						row={row}
						maxRevenue={maxRevenue}
						isWeeklyTrend={isWeeklyTrend}
						isTrendTransitioning={isTrendTransitioning}
						selectedTrendMonth={selectedTrendMonth}
						onMonthSelect={onMonthSelect}
					/>
				))}
			</div>
		</div>
	);
}

function TrendDesktopChart({
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

function RevenueTrendCard({
	hasRevenue,
	isWeeklyTrend,
	displayedMonthLabel,
	isTrendTransitioning,
	trendLoadingLabel,
	isReturningToMonthly,
	mobileRows,
	bestRow,
	maxRevenue,
	selectedTrendMonth,
	trendChartData,
	onMonthSelect,
	onClearMonth,
}: {
	hasRevenue: boolean;
	isWeeklyTrend: boolean;
	displayedMonthLabel: string | null;
	isTrendTransitioning: boolean;
	trendLoadingLabel: string;
	isReturningToMonthly: boolean;
	mobileRows: TrendChartRow[];
	bestRow: TrendChartRow | null;
	maxRevenue: number;
	selectedTrendMonth: string | null;
	trendChartData: TrendChartRow[];
	onMonthSelect: (month: string) => void;
	onClearMonth: () => void;
}) {
	return (
		<Card>
			<CardHeader>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<IconTrendingUp className="size-5" />
							{isWeeklyTrend ? `${displayedMonthLabel} Weekly Revenue` : "Monthly Revenue Trend"}
						</CardTitle>
						<CardDescription>
							{isWeeklyTrend ? "Revenue and order count by week" : "Revenue and order count by month"}
						</CardDescription>
					</div>
					<div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
						{isTrendTransitioning && (
							<div
								className="inline-flex h-8 items-center justify-center gap-2 rounded-full border bg-card px-3 text-xs font-medium text-muted-foreground shadow-sm"
								aria-live="polite"
							>
								<IconLoader2 className="size-3.5 animate-spin text-primary" />
								<span>{trendLoadingLabel}</span>
							</div>
						)}
						{isWeeklyTrend && (
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="w-full shrink-0 gap-1 sm:w-auto"
								onClick={onClearMonth}
								disabled={isReturningToMonthly}
							>
								<IconX className="size-4" />
								Back to monthly
							</Button>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{hasRevenue ? (
					<>
						<TrendMobileRows
							rows={mobileRows}
							bestRow={bestRow}
							maxRevenue={maxRevenue}
							isWeeklyTrend={isWeeklyTrend}
							isTrendTransitioning={isTrendTransitioning}
							selectedTrendMonth={selectedTrendMonth}
							onMonthSelect={onMonthSelect}
						/>
						<TrendDesktopChart
							rows={trendChartData}
							isWeeklyTrend={isWeeklyTrend}
							isTrendTransitioning={isTrendTransitioning}
							onMonthSelect={onMonthSelect}
						/>
					</>
				) : (
					<div className="h-80 flex items-center justify-center text-muted-foreground">
						No monthly revenue data available yet. Data will appear after the analytics worker processes completed
						months.
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function DessertRevenueMobileList({
	rows,
	topDessertShare,
	total,
	maxDessertRevenue,
}: {
	rows: PieChartRow[];
	topDessertShare: number;
	total: number;
	maxDessertRevenue: number;
}) {
	return (
		<div className="space-y-3 md:hidden">
			<div className="grid grid-cols-3 gap-2">
				<div className="rounded-lg border bg-muted/30 px-3 py-2.5">
					<p className="text-xs font-medium text-muted-foreground">Top</p>
					<p className="mt-1 text-base font-semibold tabular-nums">{(topDessertShare * 100).toFixed(0)}%</p>
				</div>
				<div className="rounded-lg border bg-muted/30 px-3 py-2.5">
					<p className="text-xs font-medium text-muted-foreground">Shown</p>
					<p className="mt-1 text-base font-semibold tabular-nums">{rows.length}</p>
				</div>
				<div className="rounded-lg border bg-muted/30 px-3 py-2.5">
					<p className="text-xs font-medium text-muted-foreground">Total</p>
					<p className="mt-1 text-base font-semibold tabular-nums">{formatCurrency(total)}</p>
				</div>
			</div>
			<div className="space-y-2">
				{rows.map((entry, index) => {
					const percent = Math.max(8, Math.round((entry.value / maxDessertRevenue) * 100));

					return (
						<div key={entry.name} className="rounded-lg border bg-card px-3 py-3">
							<div className="mb-2 flex items-center gap-3">
								<span className="text-xs font-semibold text-muted-foreground tabular-nums">#{index + 1}</span>
								<span
									className="size-2.5 shrink-0 rounded-full"
									style={{ backgroundColor: entry.fill }}
									aria-hidden="true"
								/>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-medium">{entry.name}</p>
									<p className="text-xs text-muted-foreground tabular-nums">
										{(entry.percent * 100).toFixed(0)}% of top desserts
									</p>
								</div>
								<p className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(entry.value)}</p>
							</div>
							<div className="h-2 overflow-hidden rounded-full bg-muted">
								<div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: entry.fill }} />
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function DessertRevenueDesktopPanel({
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

function DessertRevenueCard({
	rows,
	total,
	selectedMonth,
	availableMonths,
	isLoading,
	onMonthChange,
}: {
	rows: PieChartRow[];
	total: number;
	selectedMonth: string;
	availableMonths: string[];
	isLoading: boolean;
	onMonthChange: (month: string) => void;
}) {
	const topDessertShare = rows[0]?.percent ?? 0;
	const maxDessertRevenue = Math.max(...rows.map((entry) => entry.value), 1);

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<CardTitle>Revenue Distribution</CardTitle>
						<CardDescription>Top 8 desserts by revenue in {formatMonth(selectedMonth)}</CardDescription>
					</div>
					<Select value={selectedMonth} onValueChange={(value) => onMonthChange(value || "")}>
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
				{rows.length === 0 ? (
					<div className="flex h-96 items-center justify-center text-muted-foreground">
						No dessert revenue data for this month
					</div>
				) : (
					<div className={`transition-opacity ${isLoading ? "opacity-70" : "opacity-100"}`}>
						<DessertRevenueMobileList
							rows={rows}
							topDessertShare={topDessertShare}
							total={total}
							maxDessertRevenue={maxDessertRevenue}
						/>
						<DessertRevenueDesktopPanel rows={rows} topDessertShare={topDessertShare} total={total} />
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function useInitialAnalyticsData({
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

	return { initialDessertRevenue, initialMonth, initialOverview };
}

function useAnalyticsQueries({
	initialDessertRevenue,
	initialMonth,
	initialOverview,
	selectedMonth,
}: {
	initialDessertRevenue: MonthlyDessertRevenue[];
	initialMonth: string;
	initialOverview: AnalyticsOverview;
	selectedMonth: string;
}) {
	const overviewQuery = useQuery({
		queryKey: ["admin-analytics", "overview"],
		queryFn: ({ signal }) => fetchAnalyticsOverview(signal),
		initialData: initialOverview,
		staleTime: 60 * 60 * 1000,
		gcTime: 2 * 60 * 60 * 1000,
	});
	const dessertRevenueQuery = useQuery({
		queryKey: ["admin-analytics", "monthly-dessert-revenue", selectedMonth],
		queryFn: ({ signal }) => fetchMonthlyDessertRevenue(selectedMonth, signal),
		initialData: selectedMonth === initialMonth ? initialDessertRevenue : undefined,
		placeholderData: (previousData) => previousData,
		staleTime: 60 * 60 * 1000,
		gcTime: 2 * 60 * 60 * 1000,
	});

	return { overviewQuery, dessertRevenueQuery };
}

function useWeeklyRevenueQuery(selectedTrendMonth: string | null) {
	return useQuery({
		queryKey: ["admin-analytics", "weekly-revenue", selectedTrendMonth],
		queryFn: ({ signal }) => fetchWeeklyRevenue(selectedTrendMonth || "", signal),
		enabled: !!selectedTrendMonth,
		placeholderData: (previousData) => previousData,
		staleTime: 60 * 60 * 1000,
		gcTime: 2 * 60 * 60 * 1000,
	});
}

function useTrendController() {
	const [selectedTrendMonth, setSelectedTrendMonth] = useState<string | null>(null);
	const [displayedTrendMonth, setDisplayedTrendMonth] = useState<string | null>(null);
	const [isReturningToMonthly, setIsReturningToMonthly] = useState(false);
	const weeklyRevenueQuery = useWeeklyRevenueQuery(selectedTrendMonth);
	const handleTrendMonthSelect = useCallback((month: string) => {
		setIsReturningToMonthly(false);
		setSelectedTrendMonth(month);
	}, []);
	const handleTrendMonthClear = useCallback(() => {
		if (!displayedTrendMonth) return;
		setIsReturningToMonthly(true);
	}, [displayedTrendMonth]);

	useEffect(() => {
		if (!selectedTrendMonth || weeklyRevenueQuery.dataUpdatedAt === 0 || weeklyRevenueQuery.isFetching) return;

		setDisplayedTrendMonth(selectedTrendMonth);
	}, [selectedTrendMonth, weeklyRevenueQuery.dataUpdatedAt, weeklyRevenueQuery.isFetching]);
	useEffect(() => {
		if (!isReturningToMonthly) return;

		const timeout = window.setTimeout(() => {
			setDisplayedTrendMonth(null);
			setSelectedTrendMonth(null);
			setIsReturningToMonthly(false);
		}, 160);

		return () => window.clearTimeout(timeout);
	}, [isReturningToMonthly]);
	useEffect(() => {
		if (!displayedTrendMonth) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				handleTrendMonthClear();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [displayedTrendMonth, handleTrendMonthClear]);

	return {
		selectedTrendMonth,
		displayedTrendMonth,
		isReturningToMonthly,
		handleTrendMonthSelect,
		handleTrendMonthClear,
		weeklyRevenueQuery,
	};
}

function useAnalyticsMetrics({
	dessertRevenue,
	monthlyRevenue,
	selectedMonth,
}: {
	dessertRevenue: MonthlyDessertRevenue[];
	monthlyRevenue: MonthlyRevenue[];
	selectedMonth: string;
}) {
	const totalRevenue = useMemo(() => monthlyRevenue.reduce((sum, row) => sum + row.grossRevenue, 0), [monthlyRevenue]);
	const totalOrders = useMemo(() => monthlyRevenue.reduce((sum, row) => sum + row.orderCount, 0), [monthlyRevenue]);
	const monthlyDessertTotal = useMemo(
		() => dessertRevenue.reduce((sum, dessert) => sum + dessert.grossRevenue, 0),
		[dessertRevenue],
	);
	const selectedMonthRevenue =
		monthlyRevenue.find((row) => row.month === selectedMonth)?.grossRevenue ?? monthlyDessertTotal;

	return { totalRevenue, totalOrders, monthlyDessertTotal, selectedMonthRevenue };
}

function useTrendRows({
	displayedTrendMonth,
	isLoadingWeeklyRevenue,
	isReturningToMonthly,
	monthlyRevenue,
	selectedTrendMonth,
	weeklyRevenue,
}: {
	displayedTrendMonth: string | null;
	isLoadingWeeklyRevenue: boolean;
	isReturningToMonthly: boolean;
	monthlyRevenue: MonthlyRevenue[];
	selectedTrendMonth: string | null;
	weeklyRevenue: WeeklyRevenue[];
}) {
	const currentYear = new Date().getFullYear();
	const monthlyChartData = useMemo(
		() => buildMonthlyChartData(monthlyRevenue, currentYear),
		[currentYear, monthlyRevenue],
	);
	const mobileMonthlyRows = useMemo(
		() => monthlyChartData.filter((row) => row.revenue !== null || row.orders !== null),
		[monthlyChartData],
	);
	const weeklyChartData = useMemo<TrendChartRow[]>(
		() =>
			weeklyRevenue.map((week) => ({
				key: week.week,
				label: week.week,
				subtitle: `${week.startDate} - ${week.endDate}`,
				revenue: week.grossRevenue,
				orders: week.orderCount,
			})),
		[weeklyRevenue],
	);
	const monthlyTrendData = useMemo<TrendChartRow[]>(
		() =>
			monthlyChartData.map((row) => ({
				key: row.monthKey,
				label: row.month,
				subtitle: row.orders === null ? "No revenue data" : `${row.orders} orders`,
				revenue: row.revenue,
				orders: row.orders,
				monthKey: row.monthKey,
			})),
		[monthlyChartData],
	);
	const isWeeklyTrend = !!displayedTrendMonth;
	const isLoadingTrendMonth =
		!!selectedTrendMonth && selectedTrendMonth !== displayedTrendMonth && isLoadingWeeklyRevenue;
	const isTrendTransitioning = isLoadingTrendMonth || isReturningToMonthly;
	const trendLoadingLabel = getTrendLoadingLabel({ isReturningToMonthly, selectedTrendMonth });
	const trendChartData = useMemo(
		() => (isWeeklyTrend ? weeklyChartData : monthlyTrendData),
		[isWeeklyTrend, monthlyTrendData, weeklyChartData],
	);
	const mobileTrendRows = useMemo<TrendChartRow[]>(
		() => (isWeeklyTrend ? weeklyChartData : buildMobileMonthlyTrendRows(mobileMonthlyRows)),
		[isWeeklyTrend, mobileMonthlyRows, weeklyChartData],
	);
	const maxTrendRevenue = useMemo(
		() => Math.max(...trendChartData.map((row) => Number(row.revenue ?? 0)), 1),
		[trendChartData],
	);
	const bestTrendRow = useMemo(() => findBestTrendRow(mobileTrendRows), [mobileTrendRows]);
	const displayedTrendMonthLabel = displayedTrendMonth ? formatMonth(displayedTrendMonth) : null;

	return {
		bestTrendRow,
		displayedTrendMonthLabel,
		isTrendTransitioning,
		isWeeklyTrend,
		maxTrendRevenue,
		mobileTrendRows,
		trendChartData,
		trendLoadingLabel,
	};
}

function buildMobileMonthlyTrendRows(rows: MonthlyChartRow[]): TrendChartRow[] {
	return rows.map((row) => ({
		key: row.monthKey,
		label: row.month,
		subtitle: `${row.orders ?? 0} orders`,
		revenue: row.revenue,
		orders: row.orders,
		monthKey: row.monthKey,
	}));
}

function findBestTrendRow(rows: TrendChartRow[]) {
	return rows.reduce<TrendChartRow | null>(
		(best, row) => (Number(row.revenue ?? 0) > Number(best?.revenue ?? -1) ? row : best),
		null,
	);
}

function getTrendLoadingLabel({
	isReturningToMonthly,
	selectedTrendMonth,
}: {
	isReturningToMonthly: boolean;
	selectedTrendMonth: string | null;
}) {
	if (isReturningToMonthly) return "Loading monthly";
	return selectedTrendMonth ? `Loading ${formatMonth(selectedTrendMonth)}` : "Loading";
}

function useQueryErrorLogs({
	dessertRevenueError,
	overviewError,
	weeklyRevenueError,
}: {
	dessertRevenueError: Error | null;
	overviewError: Error | null;
	weeklyRevenueError: Error | null;
}) {
	useEffect(() => {
		if (dessertRevenueError) {
			console.error("Failed to fetch dessert revenue:", dessertRevenueError);
		}
	}, [dessertRevenueError]);
	useEffect(() => {
		if (overviewError) {
			console.error("Failed to fetch analytics overview:", overviewError);
		}
	}, [overviewError]);
	useEffect(() => {
		if (weeklyRevenueError) {
			console.error("Failed to fetch weekly revenue:", weeklyRevenueError);
		}
	}, [weeklyRevenueError]);
}

export function AnalyticsContent({
	monthlyRevenue,
	monthlyDessertRevenue,
	availableMonths: availableMonthsPromise,
	initialMonth: initialMonthPromise,
}: AnalyticsContentProps) {
	const initialData = useInitialAnalyticsData({
		monthlyRevenue,
		monthlyDessertRevenue,
		availableMonths: availableMonthsPromise,
		initialMonth: initialMonthPromise,
	});
	const { initialDessertRevenue, initialMonth, initialOverview } = initialData;
	const [selectedMonth, setSelectedMonth] = useState(initialMonth);
	const handleMonthChange = useCallback((month: string) => {
		setSelectedMonth(month);
	}, []);
	const { dessertRevenueQuery, overviewQuery } = useAnalyticsQueries({
		initialDessertRevenue,
		initialMonth,
		initialOverview,
		selectedMonth,
	});
	const trendSelection = useTrendController();
	const { weeklyRevenueQuery } = trendSelection;
	const trendRows = useTrendRows({
		displayedTrendMonth: trendSelection.displayedTrendMonth,
		isLoadingWeeklyRevenue: weeklyRevenueQuery.isFetching,
		isReturningToMonthly: trendSelection.isReturningToMonthly,
		monthlyRevenue: overviewQuery.data.monthlyRevenue,
		selectedTrendMonth: trendSelection.selectedTrendMonth,
		weeklyRevenue: weeklyRevenueQuery.data ?? [],
	});
	const metrics = useAnalyticsMetrics({
		dessertRevenue: dessertRevenueQuery.data ?? [],
		monthlyRevenue: overviewQuery.data.monthlyRevenue,
		selectedMonth,
	});
	useQueryErrorLogs({
		dessertRevenueError: dessertRevenueQuery.error,
		overviewError: overviewQuery.error,
		weeklyRevenueError: weeklyRevenueQuery.error,
	});

	const dessertRevenue = dessertRevenueQuery.data ?? [];
	const pieChartData = useMemo(() => buildPieChartData(dessertRevenue), [dessertRevenue]);
	const availableMonths = overviewQuery.data.availableMonths;
	const overviewMonthlyRevenue = overviewQuery.data.monthlyRevenue;

	return (
		<div className="flex-1 space-y-6">
			<div>
				<h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
				<p className="text-muted-foreground">Revenue trends, dessert performance, and stock insights</p>
			</div>

			<SummaryCards
				totalRevenue={metrics.totalRevenue}
				totalOrders={metrics.totalOrders}
				month={selectedMonth}
				selectedMonthRevenue={metrics.selectedMonthRevenue}
				dessertCount={dessertRevenue.length}
				monthCount={overviewMonthlyRevenue.length}
			/>
			<RevenueTrendCard
				hasRevenue={overviewMonthlyRevenue.length > 0}
				isWeeklyTrend={trendRows.isWeeklyTrend}
				displayedMonthLabel={trendRows.displayedTrendMonthLabel}
				isTrendTransitioning={trendRows.isTrendTransitioning}
				trendLoadingLabel={trendRows.trendLoadingLabel}
				isReturningToMonthly={trendSelection.isReturningToMonthly}
				mobileRows={trendRows.mobileTrendRows}
				bestRow={trendRows.bestTrendRow}
				maxRevenue={trendRows.maxTrendRevenue}
				selectedTrendMonth={trendSelection.selectedTrendMonth}
				trendChartData={trendRows.trendChartData}
				onMonthSelect={trendSelection.handleTrendMonthSelect}
				onClearMonth={trendSelection.handleTrendMonthClear}
			/>
			<DessertRevenueCard
				rows={pieChartData}
				total={metrics.monthlyDessertTotal}
				selectedMonth={selectedMonth}
				availableMonths={availableMonths}
				isLoading={dessertRevenueQuery.isFetching}
				onMonthChange={handleMonthChange}
			/>
		</div>
	);
}
