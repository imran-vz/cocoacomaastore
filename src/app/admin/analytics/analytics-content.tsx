"use client";

import { IconChevronLeft, IconLoader2 } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { lazy, use, useCallback, useEffect, useMemo, useReducer, useState } from "react";
import type { MonthlyDessertRevenue, MonthlyRevenue, WeeklyRevenue } from "@/app/admin/dashboard/actions";
import {
	bestSlot,
	type ChartSlot,
	ChartSlotDetail,
	countSalesSlots,
	RevenueBarChart,
	SparseChartState,
	slotStepper,
} from "@/components/admin/dashboard/bar-chart";
import { InsightsHeader } from "@/components/admin/dashboard/insights-header";
import { KpiSummary } from "@/components/admin/dashboard/stats-card";
import { DesktopChartSlot } from "@/components/desktop-chart-slot";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RecordList } from "@/components/ui/list-row";
import { SectionHeading } from "@/components/ui/section-heading";
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
import { formatCount, formatINR, formatMonth, formatMonthShort, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const TrendDesktopChart = lazy(() =>
	import("./analytics-charts").then((module) => ({ default: module.TrendDesktopChart })),
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

/** A month or week on the trend chart. `monthKey` is set on months (they drill into weeks). */
export type TrendSlot = ChartSlot & {
	title: string;
	subtitle?: string;
	monthKey?: string;
};

type RankedDessert = {
	id: number;
	name: string;
	revenue: number;
	quantitySold: number;
	/** Share of the month's dessert revenue (0–1). */
	share: number;
};

const TOP_DESSERT_COUNT = 8;
const MONTHS_OF = { one: "month", other: "months" };

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

function addMonths(monthKey: string, offset: number): string {
	const [year, month] = monthKey.split("-").map(Number);
	const date = new Date(Date.UTC(year, month - 1 + offset, 1));
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Every month from the first to the last month with data, so a quiet month still shows as a slot. */
function buildMonthSlots(monthlyRevenue: MonthlyRevenue[]): TrendSlot[] {
	if (monthlyRevenue.length === 0) return [];
	const byMonth = new Map(monthlyRevenue.map((row) => [row.month, row]));
	const keys = [...byMonth.keys()].sort();
	const last = keys[keys.length - 1];
	// At most 12 slots, always ending on the latest month: a gap in the data must never push
	// the newest (usually current) month off the chart.
	const earliest = addMonths(last, -11);
	const first = keys[0] > earliest ? keys[0] : earliest;
	const slots: TrendSlot[] = [];
	for (let key = first; key <= last; key = addMonths(key, 1)) {
		const row = byMonth.get(key);
		slots.push({
			key,
			monthKey: key,
			axisLabel: formatMonthShort(key),
			title: formatMonth(key),
			revenue: row?.grossRevenue ?? 0,
			orders: row?.orderCount ?? 0,
		});
	}
	return slots;
}

function buildWeekSlots(weeklyRevenue: WeeklyRevenue[]): TrendSlot[] {
	return weeklyRevenue.map((week) => ({
		key: week.week,
		axisLabel: week.week.replace(/^\D*(\d+)$/, "W$1"),
		title: week.week,
		subtitle: week.startDate === week.endDate ? week.startDate : `${week.startDate} – ${week.endDate}`,
		revenue: week.grossRevenue,
		orders: week.orderCount,
	}));
}

function rankDesserts(dessertRevenue: MonthlyDessertRevenue[], monthTotal: number): RankedDessert[] {
	return dessertRevenue.slice(0, TOP_DESSERT_COUNT).map((dessert) => ({
		id: dessert.dessertId,
		name: dessert.dessertName,
		revenue: dessert.grossRevenue,
		quantitySold: dessert.quantitySold,
		share: monthTotal > 0 ? dessert.grossRevenue / monthTotal : 0,
	}));
}

function describeSlot(slot: ChartSlot) {
	return `${slot.axisLabel}, ${formatINR(slot.revenue)}, ${formatCount(slot.orders, "orders")}`;
}

/** "Jan–Sep 2026", or "Nov 2025–Sep 2026" across a year. */
export function monthRangeLabel(months: string[]): string {
	const sorted = [...months].sort();
	const first = sorted[0];
	const last = sorted.at(-1);
	if (!first || !last) return "";
	if (first === last) return formatMonth(first);
	return first.slice(0, 4) === last.slice(0, 4)
		? `${formatMonthShort(first)}–${formatMonthShort(last, { withYear: true })}`
		: `${formatMonthShort(first, { withYear: true })}–${formatMonthShort(last, { withYear: true })}`;
}

/**
 * Revenue by month (or, drilled in, by week). The selected month is the page's one month
 * selection, shared with Top desserts: tapping a bar, the 44px arrows beside the summary
 * and the month picker on Top desserts all move it, so every month figure on the page
 * names the same month.
 */
function TrendSection({
	slots,
	isWeeklyTrend,
	displayedMonthLabel,
	selectedMonth,
	isTrendTransitioning,
	trendLoadingLabel,
	isReturningToMonthly,
	onSelectMonth,
	onDrillMonth,
	onClearMonth,
}: {
	slots: TrendSlot[];
	isWeeklyTrend: boolean;
	displayedMonthLabel: string | null;
	selectedMonth: string;
	isTrendTransitioning: boolean;
	trendLoadingLabel: string;
	isReturningToMonthly: boolean;
	onSelectMonth: (month: string) => void;
	onDrillMonth: (month: string) => void;
	onClearMonth: () => void;
}) {
	const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);
	const unit = isWeeklyTrend ? "week" : "month";
	const best = bestSlot(slots);
	const salesSlots = countSalesSlots(slots);
	const selected = isWeeklyTrend
		? (slots.find((slot) => slot.key === selectedWeekKey) ?? best ?? slots.at(-1) ?? null)
		: (slots.find((slot) => slot.key === selectedMonth) ?? null);
	const onSelect = isWeeklyTrend ? setSelectedWeekKey : onSelectMonth;

	const drillAction = (slot: TrendSlot) =>
		!isWeeklyTrend && slot.monthKey && slot.revenue > 0 ? (
			<Button
				variant="outline"
				className="w-full @3xl/main:w-auto"
				disabled={isTrendTransitioning}
				onClick={() => onDrillMonth(slot.monthKey ?? "")}
			>
				View weeks of {formatMonthShort(slot.monthKey)}
			</Button>
		) : undefined;

	const detail = (slot: TrendSlot, className?: string) => (
		<ChartSlotDetail
			className={className}
			title={slot.title}
			meta={[slot.subtitle, slot.revenue > 0 ? formatCount(slot.orders, "orders") : "No sales"]
				.filter(Boolean)
				.join(" · ")}
			value={formatINR(slot.revenue)}
			note={salesSlots >= 2 && slot.key === best?.key ? `Best ${unit}` : undefined}
			action={drillAction(slot)}
			stepper={slotStepper(slots, slot, onSelect, unit)}
		/>
	);

	return (
		<section aria-labelledby="revenue-trend">
			<SectionHeading
				id="revenue-trend"
				title={isWeeklyTrend ? `${displayedMonthLabel} by week` : "Revenue by month"}
				action={
					isTrendTransitioning ? (
						<span className="inline-flex items-center gap-1.5 text-muted-foreground" aria-live="polite">
							<IconLoader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
							{trendLoadingLabel}
						</span>
					) : isWeeklyTrend ? (
						<Button variant="ghost" size="sm" onClick={onClearMonth} disabled={isReturningToMonthly}>
							<IconChevronLeft aria-hidden="true" />
							All months
						</Button>
					) : null
				}
			/>
			<div
				className={cn(
					"@container rounded-xl border bg-card p-4 transition-opacity motion-reduce:transition-none",
					isTrendTransitioning && "opacity-60",
				)}
			>
				{slots.length === 0 ? (
					<EmptyState
						framed={false}
						description="No monthly sales yet. Months appear here once the analytics worker has processed them."
					/>
				) : salesSlots < 2 ? (
					<SparseChartState
						message={
							salesSlots === 0
								? `No sales in this ${isWeeklyTrend ? "month" : "period"}.`
								: `Only one ${unit} with sales in this period.`
						}
					>
						{best ? detail(best) : null}
					</SparseChartState>
				) : (
					<>
						<div className="@xl:hidden">
							<RevenueBarChart
								slots={slots}
								selectedKey={selected?.key ?? null}
								onSelect={onSelect}
								describe={describeSlot}
							/>
						</div>
						<DesktopChartSlot fallbackClassName="h-72 w-full">
							<TrendDesktopChart
								slots={slots}
								selectedKey={selected?.key ?? null}
								isTrendTransitioning={isTrendTransitioning}
								onSelect={onSelect}
							/>
						</DesktopChartSlot>
						{selected ? detail(selected, "mt-4") : null}
					</>
				)}
			</div>
		</section>
	);
}

/**
 * Top desserts for the selected month. Each bar is the dessert's printed share of the
 * month's dessert revenue, so a 31% dessert fills 31% of the track.
 */
function TopDessertsSection({
	rows,
	selectedMonth,
	availableMonths,
	isLoading,
	onMonthChange,
}: {
	rows: RankedDessert[];
	selectedMonth: string;
	availableMonths: string[];
	isLoading: boolean;
	onMonthChange: (month: string) => void;
}) {
	return (
		<section aria-labelledby="top-desserts">
			<SectionHeading
				id="top-desserts"
				title="Top desserts"
				action={
					<Select value={selectedMonth} onValueChange={(value) => onMonthChange(value || "")}>
						<SelectTrigger className="w-44" aria-label="Month">
							<SelectValue placeholder="Select month">
								{(value: string | null) => (value ? formatMonth(value) : "Select month")}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{availableMonths.map((month) => (
								<SelectItem key={month} value={month}>
									{formatMonth(month)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				}
			/>
			{rows.length === 0 ? (
				<EmptyState description={`No dessert sales in ${formatMonth(selectedMonth)}.`} />
			) : (
				<RecordList
					aria-label={`Top desserts in ${formatMonth(selectedMonth)}`}
					aria-busy={isLoading || undefined}
					className={cn("transition-opacity motion-reduce:transition-none", isLoading && "opacity-60")}
				>
					{rows.map((row, index) => (
						<li key={row.id} className="px-4 py-3">
							<div className="flex items-baseline gap-3">
								<span className="w-4 shrink-0 text-[13px] text-muted-foreground tabular-nums">{index + 1}</span>
								<div className="min-w-0 flex-1">
									<p className="line-clamp-2 text-[15px] leading-5 font-semibold break-words">{row.name}</p>
									<p className="text-[13px] leading-[18px] text-muted-foreground tabular-nums">
										{formatCount(row.quantitySold, "sold")} · {formatPercent(row.share)} of sales
									</p>
								</div>
								<p className="shrink-0 text-[15px] font-semibold whitespace-nowrap tabular-nums">
									{formatINR(row.revenue)}
								</p>
							</div>
							<div className="mt-2 ml-7 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
								<div
									className="h-full rounded-full bg-primary"
									style={{ width: `${Math.max(1, Math.min(100, row.share * 100))}%` }}
								/>
							</div>
						</li>
					))}
				</RecordList>
			)}
		</section>
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
}: {
	dessertRevenue: MonthlyDessertRevenue[];
	monthlyRevenue: MonthlyRevenue[];
}) {
	const totalRevenue = useMemo(() => monthlyRevenue.reduce((sum, row) => sum + row.grossRevenue, 0), [monthlyRevenue]);
	const totalOrders = useMemo(() => monthlyRevenue.reduce((sum, row) => sum + row.orderCount, 0), [monthlyRevenue]);
	const monthlyDessertTotal = useMemo(
		() => dessertRevenue.reduce((sum, dessert) => sum + dessert.grossRevenue, 0),
		[dessertRevenue],
	);

	return { totalRevenue, totalOrders, monthlyDessertTotal };
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
	const metrics = useAnalyticsMetrics({
		dessertRevenue,
		monthlyRevenue: overviewMonthlyRevenue,
	});
	useQueryErrorLogs({
		dessertRevenueError: dessertRevenueQuery.error,
		overviewError: overviewQuery.error,
		weeklyRevenueError: weeklyRevenueQuery.error,
	});

	const monthSlots = useMemo(() => buildMonthSlots(overviewMonthlyRevenue), [overviewMonthlyRevenue]);
	const { handleTrendMonthSelect } = trendSelection;
	const handleDrillMonth = useCallback(
		(month: string) => {
			setSelectedMonth(month);
			handleTrendMonthSelect(month);
		},
		[handleTrendMonthSelect],
	);
	const weekSlots = useMemo(() => buildWeekSlots(weeklyRevenueQuery.data ?? []), [weeklyRevenueQuery.data]);
	const rankedDesserts = useMemo(
		() => rankDesserts(dessertRevenue, metrics.monthlyDessertTotal),
		[dessertRevenue, metrics.monthlyDessertTotal],
	);
	const availableMonths = overviewQuery.data.availableMonths;
	const rangeLabel = monthRangeLabel(overviewMonthlyRevenue.map((row) => row.month));
	const avgOrderValue = metrics.totalOrders > 0 ? metrics.totalRevenue / metrics.totalOrders : 0;

	return (
		<div>
			<InsightsHeader />

			<div className="space-y-6">
				{overviewMonthlyRevenue.length > 0 ? (
					<section aria-labelledby="months-summary">
						<SectionHeading
							id="months-summary"
							title={rangeLabel}
							count={formatCount(overviewMonthlyRevenue.length, MONTHS_OF)}
						/>
						<KpiSummary
							aria-labelledby="months-summary"
							lead={{ label: "Revenue", value: formatINR(metrics.totalRevenue) }}
							figures={[
								{ label: "Orders", value: formatNumber(metrics.totalOrders) },
								{ label: "Avg order value", value: formatINR(avgOrderValue, { paise: "never" }) },
							]}
						/>
					</section>
				) : null}

				<TrendSection
					slots={trendSelection.isWeeklyTrend ? weekSlots : monthSlots}
					isWeeklyTrend={trendSelection.isWeeklyTrend}
					displayedMonthLabel={
						trendSelection.displayedTrendMonth ? formatMonth(trendSelection.displayedTrendMonth) : null
					}
					selectedMonth={selectedMonth}
					isTrendTransitioning={trendSelection.isTrendTransitioning}
					trendLoadingLabel={trendSelection.trendLoadingLabel}
					isReturningToMonthly={trendSelection.isReturningToMonthly}
					onSelectMonth={setSelectedMonth}
					onDrillMonth={handleDrillMonth}
					onClearMonth={trendSelection.handleTrendMonthClear}
				/>

				<TopDessertsSection
					rows={rankedDesserts}
					selectedMonth={selectedMonth}
					availableMonths={availableMonths}
					isLoading={dessertRevenueQuery.isFetching}
					onMonthChange={setSelectedMonth}
				/>
			</div>
		</div>
	);
}
