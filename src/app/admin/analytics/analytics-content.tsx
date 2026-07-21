"use client";

import { IconCalendar, IconChartBar, IconLoader2, IconTrendingUp, IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { lazy, Suspense, use, useCallback, useEffect, useMemo, useReducer, useState } from "react";
import type { MonthlyDessertRevenue, MonthlyRevenue, WeeklyRevenue } from "@/app/admin/dashboard/actions";
import { Button } from "@/components/ui/button";
import StatCard, { StatCardGrid } from "@/components/admin/dashboard/stats-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
	displayedTrendMonth,
	getTrendTransition,
	initialTrendState,
	isReturningToMonthly,
	selectedTrendMonth,
	type TrendState,
	trendReducer,
} from "@/lib/analytics-trend-machine";
import { formatCurrency } from "@/lib/utils";

const TrendDesktopChart = lazy(() =>
	import("./analytics-charts").then((module) => ({ default: module.TrendDesktopChart })),
);
const DessertRevenueDesktopPanel = lazy(() =>
	import("./analytics-charts").then((module) => ({ default: module.DessertRevenueDesktopPanel })),
);

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

export type TrendChartRow = {
	key: string;
	label: string;
	subtitle: string;
	revenue: number | null;
	orders: number | null;
	monthKey?: string;
};

export type PieChartRow = {
	name: string;
	value: number;
	percent: number;
	quantitySold: number;
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

function formatMonth(month: string): string {
	const [year, monthNum] = month.split("-");
	const date = new Date(Number(year), Number(monthNum) - 1);
	return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
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
		quantitySold: dessert.quantitySold,
		fill: COLORS[index % COLORS.length],
	}));
}

function useIsDesktop() {
	const [isDesktop, setIsDesktop] = useState(false);

	useEffect(() => {
		const mediaQuery = window.matchMedia("(min-width: 768px)");
		const updateIsDesktop = () => setIsDesktop(mediaQuery.matches);

		updateIsDesktop();
		mediaQuery.addEventListener("change", updateIsDesktop);

		return () => mediaQuery.removeEventListener("change", updateIsDesktop);
	}, []);

	return isDesktop;
}

function DesktopChartSlot({ children, fallbackClassName }: { children: ReactNode; fallbackClassName: string }) {
	const isDesktop = useIsDesktop();

	if (!isDesktop) return null;

	return <Suspense fallback={<div className={fallbackClassName} aria-hidden="true" />}>{children}</Suspense>;
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
		<StatCardGrid className="grid-cols-1 md:grid-cols-3">
			<StatCard
				title="Total Revenue"
				value={formatCurrency(totalRevenue)}
				subtitle={`Across ${monthCount} months`}
				icon={IconTrendingUp}
			/>
			<StatCard
				title="Total Orders"
				value={totalOrders.toLocaleString()}
				subtitle={`Avg ${totalOrders > 0 ? formatCurrency(totalRevenue / totalOrders) : "₹0"} per order`}
				icon={IconChartBar}
			/>
			<StatCard
				title={`${formatMonth(month)} Revenue`}
				value={formatCurrency(selectedMonthRevenue)}
				subtitle={`From ${dessertCount} desserts`}
				icon={IconCalendar}
			/>
		</StatCardGrid>
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

function getTrendBarLabel(row: TrendChartRow, isWeeklyTrend: boolean) {
	if (isWeeklyTrend) return row.label.replace(/^Business Week\s*/i, "W");
	return row.label.split(" ")[0];
}

function TrendMobileRows({
	rows,
	bestRow,
	maxRevenue,
	isWeeklyTrend,
	isTrendTransitioning,
	onMonthSelect,
}: {
	rows: TrendChartRow[];
	bestRow: TrendChartRow | null;
	maxRevenue: number;
	isWeeklyTrend: boolean;
	isTrendTransitioning: boolean;
	onMonthSelect: (month: string) => void;
}) {
	const [selectedKey, setSelectedKey] = useState<string | null>(null);
	const selectedRow = rows.find((row) => row.key === selectedKey) ?? bestRow ?? rows[0];
	const totalRevenue = rows.reduce((sum, row) => sum + Number(row.revenue ?? 0), 0);

	if (!selectedRow) {
		return <p className="py-8 text-center text-sm text-muted-foreground md:hidden">No revenue data yet</p>;
	}

	const selectedRevenue = Number(selectedRow.revenue ?? 0);
	const canDrillIn = isTrendRowDrillable({ isTrendTransitioning, isWeeklyTrend, row: selectedRow });
	const isBest = selectedRow.key === bestRow?.key && selectedRevenue > 0;

	return (
		<div className="relative space-y-4 transition-opacity md:hidden">
			<div className="flex h-40 items-end gap-1.5">
				{rows.map((row) => {
					const revenue = Number(row.revenue ?? 0);
					const isSelected = row.key === selectedRow.key;

					return (
						<button
							key={row.key}
							type="button"
							aria-pressed={isSelected}
							aria-label={`${row.label}, ${formatCurrency(revenue)}, ${row.orders ?? 0} orders`}
							onClick={() => setSelectedKey(row.key)}
							className="flex h-full flex-1 flex-col items-center gap-2"
						>
							<div className="flex w-full flex-1 items-end justify-center">
								{revenue > 0 ? (
									<div
										className={`w-full max-w-[30px] rounded-t-md bg-[#f2b38d] transition-opacity ${isSelected ? "opacity-100" : "opacity-40"}`}
										style={{ height: `${Math.round((revenue / maxRevenue) * 100)}%` }}
									/>
								) : (
									<div
										className={`h-1.5 w-full max-w-[30px] rounded-full transition-colors ${isSelected ? "bg-muted-foreground/50" : "bg-muted"}`}
									/>
								)}
							</div>
							<span
								className={`text-[10px] font-semibold tabular-nums ${isSelected ? "text-foreground" : "text-muted-foreground"}`}
							>
								{getTrendBarLabel(row, isWeeklyTrend)}
							</span>
						</button>
					);
				})}
			</div>
			<div className="rounded-xl border bg-muted/30 px-4 py-3.5">
				<div className="flex items-baseline justify-between gap-3">
					<div className="min-w-0">
						<p className="truncate text-sm font-semibold">{selectedRow.label}</p>
						{isWeeklyTrend && <p className="text-xs text-muted-foreground tabular-nums">{selectedRow.subtitle}</p>}
					</div>
					<p className="shrink-0 text-lg font-bold tabular-nums text-[#c9702e] dark:text-[#f0a06a]">
						{formatCurrency(selectedRevenue)}
					</p>
				</div>
				<div className="mt-1 flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
					<p className="tabular-nums">
						{selectedRow.orders ?? 0} order{selectedRow.orders === 1 ? "" : "s"}
					</p>
					{isBest ? (
						<p className="font-semibold text-[#12877f]">Best {isWeeklyTrend ? "week" : "month"}</p>
					) : (
						<p className="tabular-nums">
							{selectedRevenue > 0 && totalRevenue > 0
								? `${Math.round((selectedRevenue / totalRevenue) * 100)}% of ${isWeeklyTrend ? "month" : "year"}`
								: "no revenue"}
						</p>
					)}
				</div>
				{canDrillIn && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="mt-3 w-full"
						onClick={() => onMonthSelect(selectedRow.monthKey ?? "")}
					>
						View weekly breakdown
					</Button>
				)}
			</div>
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
							onMonthSelect={onMonthSelect}
						/>
						<DesktopChartSlot fallbackClassName="hidden h-80 md:block">
							<TrendDesktopChart
								rows={trendChartData}
								isWeeklyTrend={isWeeklyTrend}
								isTrendTransitioning={isTrendTransitioning}
								onMonthSelect={onMonthSelect}
							/>
						</DesktopChartSlot>
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
										{(entry.percent * 100).toFixed(0)}% of top desserts ({entry.quantitySold.toLocaleString()} Nos)
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
						<DesktopChartSlot fallbackClassName="hidden min-h-96 md:block">
							<DessertRevenueDesktopPanel rows={rows} topDessertShare={topDessertShare} total={total} />
						</DesktopChartSlot>
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

const TREND_EXIT_DURATION_MS = 160;

function useTrendController() {
	const [trendState, dispatchTrend] = useReducer(trendReducer, initialTrendState);
	const selectedMonth = selectedTrendMonth(trendState);
	const displayedMonth = displayedTrendMonth(trendState);
	const weeklyRevenueQuery = useWeeklyRevenueQuery(selectedMonth);
	const { isWeeklyTrend, isTrendTransitioning } = getTrendTransition(trendState, weeklyRevenueQuery.isFetching);
	const handleTrendMonthSelect = useCallback((month: string) => {
		dispatchTrend({ type: "select", month });
	}, []);
	const handleTrendMonthClear = useCallback(() => {
		dispatchTrend({ type: "clear" });
	}, []);

	useEffect(() => {
		if (!selectedMonth || weeklyRevenueQuery.dataUpdatedAt === 0 || weeklyRevenueQuery.isFetching) return;

		dispatchTrend({ type: "loaded" });
	}, [selectedMonth, weeklyRevenueQuery.dataUpdatedAt, weeklyRevenueQuery.isFetching]);
	useEffect(() => {
		if (trendState.status !== "exiting") return;

		const timeout = window.setTimeout(() => dispatchTrend({ type: "exitComplete" }), TREND_EXIT_DURATION_MS);
		return () => window.clearTimeout(timeout);
	}, [trendState.status]);
	useEffect(() => {
		if (!displayedMonth) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				handleTrendMonthClear();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [displayedMonth, handleTrendMonthClear]);

	return {
		selectedTrendMonth: selectedMonth,
		displayedTrendMonth: displayedMonth,
		isReturningToMonthly: isReturningToMonthly(trendState),
		isWeeklyTrend,
		isTrendTransitioning,
		trendLoadingLabel: getTrendLoadingLabel(trendState),
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
	isWeeklyTrend,
	monthlyRevenue,
	weeklyRevenue,
}: {
	displayedTrendMonth: string | null;
	isWeeklyTrend: boolean;
	monthlyRevenue: MonthlyRevenue[];
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
		maxTrendRevenue,
		mobileTrendRows,
		trendChartData,
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

function getTrendLoadingLabel(state: TrendState): string {
	if (state.status === "exiting") return "Loading monthly";
	const month = selectedTrendMonth(state);
	return month ? `Loading ${formatMonth(month)}` : "Loading";
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
	const { initialDessertRevenue, initialMonth, initialOverview } = useInitialAnalyticsData({
		monthlyRevenue,
		monthlyDessertRevenue,
		availableMonths: availableMonthsPromise,
		initialMonth: initialMonthPromise,
	});
	const [selectedMonth, setSelectedMonth] = useState(initialMonth);
	const { dessertRevenueQuery, overviewQuery } = useAnalyticsQueries({
		initialDessertRevenue,
		initialMonth,
		initialOverview,
		selectedMonth,
	});
	const dessertRevenue = dessertRevenueQuery.data ?? [];
	const overviewMonthlyRevenue = overviewQuery.data.monthlyRevenue;
	const trendSelection = useTrendController();
	const { weeklyRevenueQuery } = trendSelection;
	const trendRows = useTrendRows({
		displayedTrendMonth: trendSelection.displayedTrendMonth,
		isWeeklyTrend: trendSelection.isWeeklyTrend,
		monthlyRevenue: overviewMonthlyRevenue,
		weeklyRevenue: weeklyRevenueQuery.data ?? [],
	});
	const metrics = useAnalyticsMetrics({
		dessertRevenue,
		monthlyRevenue: overviewMonthlyRevenue,
		selectedMonth,
	});
	useQueryErrorLogs({
		dessertRevenueError: dessertRevenueQuery.error,
		overviewError: overviewQuery.error,
		weeklyRevenueError: weeklyRevenueQuery.error,
	});

	const pieChartData = useMemo(() => buildPieChartData(dessertRevenue), [dessertRevenue]);
	const availableMonths = overviewQuery.data.availableMonths;

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
				isWeeklyTrend={trendSelection.isWeeklyTrend}
				displayedMonthLabel={trendRows.displayedTrendMonthLabel}
				isTrendTransitioning={trendSelection.isTrendTransitioning}
				trendLoadingLabel={trendSelection.trendLoadingLabel}
				isReturningToMonthly={trendSelection.isReturningToMonthly}
				mobileRows={trendRows.mobileTrendRows}
				bestRow={trendRows.bestTrendRow}
				maxRevenue={trendRows.maxTrendRevenue}
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
				onMonthChange={setSelectedMonth}
			/>
		</div>
	);
}
