"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { use, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RecordList } from "@/components/ui/list-row";
import { SectionHeading } from "@/components/ui/section-heading";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ChartSlotDetail, SparseChartState } from "@/features/insights/chart-slot-detail";
import { bestSlot, hasTrend, type RevenueSlot, slotStepper } from "@/features/insights/chart-slots";
import { insightsQueries } from "@/features/insights/client";
import { InsightsHeader } from "@/features/insights/insights-header";
import { averageOrderValue, KpiSummary } from "@/features/insights/kpi-summary";
import { RevenueChart } from "@/features/insights/revenue-chart";
import type { AnalyticsOverview, BusinessWeekTotals, DessertSales, MonthTotals } from "@/features/insights/shapes";
import {
	formatCount,
	formatDateShort,
	formatINR,
	formatMonth,
	formatMonthRange,
	formatMonthShort,
	formatNumber,
	formatPercent,
	UNIT,
} from "@/lib/format";
import type { ServerSnapshot } from "@/lib/server-snapshot";
import type { MonthKey } from "@/lib/shop-calendar";
import { useSeededQuery } from "@/lib/use-seeded-query";
import { cn } from "@/lib/utils";

/** A month or week on the trend chart. `monthKey` is set on months (they drill into weeks). */
type TrendSlot = RevenueSlot & { monthKey?: MonthKey };

type RankedDessert = {
	id: number;
	name: string;
	revenue: number;
	quantitySold: number;
	/** Share of the month's dessert revenue (0–1). */
	share: number;
};

const TOP_DESSERT_COUNT = 8;

function monthSlot(point: MonthTotals): TrendSlot {
	return {
		key: point.month,
		monthKey: point.month,
		axisLabel: formatMonthShort(point.month),
		title: formatMonth(point.month),
		revenue: point.revenue,
		orders: point.orders,
	};
}

function weekSlot(week: BusinessWeekTotals): TrendSlot {
	return {
		key: String(week.index),
		axisLabel: `W${week.index}`,
		title: `Week ${week.index}`,
		subtitle:
			week.firstDay === week.lastDay
				? formatDateShort(week.firstDay)
				: `${formatDateShort(week.firstDay)} – ${formatDateShort(week.lastDay)}`,
		revenue: week.revenue,
		orders: week.orders,
	};
}

function rankDesserts(desserts: DessertSales[]): RankedDessert[] {
	const total = desserts.reduce((sum, dessert) => sum + dessert.revenue, 0);
	return desserts.slice(0, TOP_DESSERT_COUNT).map((dessert) => ({
		id: dessert.dessertId,
		name: dessert.dessertName,
		revenue: dessert.revenue,
		quantitySold: dessert.quantitySold,
		share: total > 0 ? dessert.revenue / total : 0,
	}));
}

/**
 * Revenue by month, or by Business Week once a month is opened. The selected month is the
 * page's one month selection, shared with Top desserts, so every month figure on the page
 * names the same month.
 */
function TrendSection({
	months,
	selectedMonth,
	onSelectMonth,
}: {
	months: MonthTotals[];
	selectedMonth: MonthKey;
	onSelectMonth: (month: MonthKey) => void;
}) {
	const [openMonth, setOpenMonth] = useState<MonthKey | null>(null);
	const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);
	const weeksQuery = useQuery(insightsQueries.businessWeeks(openMonth));
	const weeks = openMonth ? weeksQuery.data : undefined;
	const isWeekly = weeks !== undefined;
	const isOpening = openMonth !== null && !isWeekly && weeksQuery.isFetching;
	const weeksFailed = openMonth !== null && !isWeekly && weeksQuery.isError;

	const slots = useMemo(() => (weeks ? weeks.map(weekSlot) : months.map(monthSlot)), [weeks, months]);
	const unit = isWeekly ? "week" : "month";
	const best = bestSlot(slots);
	const showTrend = hasTrend(slots);
	const selected = isWeekly
		? (slots.find((slot) => slot.key === selectedWeekKey) ?? best ?? slots.at(-1) ?? null)
		: (slots.find((slot) => slot.key === selectedMonth) ?? null);
	const onSelect = isWeekly ? setSelectedWeekKey : onSelectMonth;

	const openWeeks = (month: MonthKey) => {
		onSelectMonth(month);
		setSelectedWeekKey(null);
		setOpenMonth(month);
	};

	const detail = (slot: TrendSlot, className?: string) => (
		<ChartSlotDetail
			className={className}
			title={slot.title}
			meta={[slot.subtitle, slot.revenue > 0 ? formatCount(slot.orders, UNIT.order) : "No sales"]
				.filter(Boolean)
				.join(" · ")}
			value={formatINR(slot.revenue)}
			note={showTrend && slot.key === best?.key ? `Best ${unit}` : undefined}
			action={
				slot.monthKey && slot.revenue > 0 ? (
					<Button
						variant="outline"
						className="w-full @3xl/main:w-auto"
						disabled={isOpening}
						onClick={() => slot.monthKey && openWeeks(slot.monthKey)}
					>
						View weeks of {formatMonthShort(slot.monthKey)}
					</Button>
				) : undefined
			}
			stepper={slotStepper(slots, slot, onSelect, unit)}
		/>
	);

	return (
		<section
			aria-labelledby="revenue-trend"
			onKeyDown={(event) => {
				// Escape from a popup portalled out of the section (a select, a dialog) is the popup's own.
				if (isWeekly && event.key === "Escape" && event.currentTarget.contains(event.target as Node)) {
					setOpenMonth(null);
				}
			}}
		>
			<SectionHeading
				id="revenue-trend"
				title={isWeekly && openMonth ? `${formatMonth(openMonth)} by week` : "Revenue by month"}
				action={
					isOpening && openMonth ? (
						<span className="inline-flex items-center gap-1.5 text-muted-foreground" aria-live="polite">
							<Spinner />
							Loading {formatMonth(openMonth)}
						</span>
					) : openMonth ? (
						<Button variant="ghost" size="sm" onClick={() => setOpenMonth(null)}>
							<ChevronLeft aria-hidden="true" />
							All months
						</Button>
					) : null
				}
			/>
			{weeksFailed && openMonth ? (
				<EmptyState
					className="mb-3"
					description={`Weeks of ${formatMonth(openMonth)} didn't load.`}
					onRetry={() => weeksQuery.refetch()}
				/>
			) : null}
			<div
				className={cn("surface-card p-4 transition-opacity motion-reduce:transition-none", isOpening && "opacity-60")}
			>
				{slots.length === 0 ? (
					<EmptyState
						framed={false}
						description="No monthly sales yet. Months appear here once the analytics worker has processed them."
					/>
				) : !showTrend ? (
					<SparseChartState
						message={
							best
								? `Only one ${unit} with sales in this period.`
								: `No sales in this ${isWeekly ? "month" : "period"}.`
						}
					>
						{best ? detail(best) : null}
					</SparseChartState>
				) : (
					<>
						<RevenueChart slots={slots} selectedKey={selected?.key ?? null} onSelect={onSelect} disabled={isOpening} />
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
	selectedMonth,
	compiledMonths,
	initialMonth,
	initialDesserts,
	onMonthChange,
}: {
	selectedMonth: MonthKey;
	compiledMonths: MonthKey[];
	initialMonth: MonthKey;
	initialDesserts: ServerSnapshot<DessertSales[]>;
	onMonthChange: (month: MonthKey) => void;
}) {
	const query = useSeededQuery(
		{ ...insightsQueries.dessertSales(selectedMonth), placeholderData: (previous) => previous },
		selectedMonth === initialMonth ? initialDesserts : undefined,
	);
	const rows = useMemo(() => rankDesserts(query.data ?? []), [query.data]);
	const failed = query.isError && (query.isPlaceholderData || query.data === undefined);

	return (
		<section aria-labelledby="top-desserts">
			<SectionHeading
				id="top-desserts"
				title="Top desserts"
				action={
					<Select value={selectedMonth} onValueChange={(value) => value && onMonthChange(value)}>
						<SelectTrigger className="w-44" aria-label="Month">
							<SelectValue placeholder="Select month">
								{(value: string | null) => (value ? formatMonth(value) : "Select month")}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{compiledMonths.map((month) => (
								<SelectItem key={month} value={month}>
									{formatMonth(month)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				}
			/>
			{failed ? (
				<EmptyState
					description={`Top desserts for ${formatMonth(selectedMonth)} didn't load.`}
					onRetry={() => query.refetch()}
				/>
			) : rows.length === 0 ? (
				<EmptyState description={`No dessert sales in ${formatMonth(selectedMonth)}.`} />
			) : (
				<RecordList
					aria-label={`Top desserts in ${formatMonth(selectedMonth)}`}
					aria-busy={query.isFetching || undefined}
					className={cn("transition-opacity motion-reduce:transition-none", query.isFetching && "opacity-60")}
				>
					{rows.map((row, index) => (
						<li key={row.id} className="px-4 py-3">
							<div className="flex items-baseline gap-3">
								<span className="w-4 shrink-0 text-meta text-muted-foreground tabular-nums">{index + 1}</span>
								<div className="min-w-0 flex-1">
									<p className="line-clamp-2 text-row wrap-break-word">{row.name}</p>
									<p className="text-meta text-muted-foreground tabular-nums">
										{formatCount(row.quantitySold, "sold")} · {formatPercent(row.share)} of sales
									</p>
								</div>
								<p className="shrink-0 text-row whitespace-nowrap tabular-nums">{formatINR(row.revenue)}</p>
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

/** Insights › Month: the months' totals, the revenue trend and the selected month's top desserts. */
export function AnalyticsContent({
	overview: overviewPromise,
	desserts: dessertsPromise,
}: {
	overview: Promise<ServerSnapshot<AnalyticsOverview>>;
	desserts: Promise<ServerSnapshot<DessertSales[]>>;
}) {
	const initialOverview = use(overviewPromise);
	const initialDesserts = use(dessertsPromise);
	const [selectedMonth, setSelectedMonth] = useState(initialOverview.data.latestMonth);
	const overviewQuery = useSeededQuery(insightsQueries.overview(), initialOverview);
	const { months, compiledMonths } = overviewQuery.data;

	const totals = {
		revenue: months.reduce((sum, month) => sum + month.revenue, 0),
		orders: months.reduce((sum, month) => sum + month.orders, 0),
	};

	return (
		<div>
			<InsightsHeader />

			<div className="space-y-6">
				{overviewQuery.isError ? (
					<EmptyState description="Monthly figures didn't refresh." onRetry={() => overviewQuery.refetch()} />
				) : null}

				{months.length > 0 ? (
					<section aria-labelledby="months-summary">
						<SectionHeading
							id="months-summary"
							title={formatMonthRange(months[0].month, months[months.length - 1].month)}
							count={formatCount(months.length, UNIT.month)}
						/>
						<KpiSummary
							aria-labelledby="months-summary"
							lead={{ label: "Revenue", value: formatINR(totals.revenue) }}
							figures={[
								{ label: "Orders", value: formatNumber(totals.orders) },
								{ label: "Avg order value", value: formatINR(averageOrderValue(totals), { paise: "never" }) },
							]}
						/>
					</section>
				) : null}

				<TrendSection months={months} selectedMonth={selectedMonth} onSelectMonth={setSelectedMonth} />

				<TopDessertsSection
					selectedMonth={selectedMonth}
					compiledMonths={compiledMonths}
					initialMonth={initialOverview.data.latestMonth}
					initialDesserts={initialDesserts}
					onMonthChange={setSelectedMonth}
				/>
			</div>
		</div>
	);
}
