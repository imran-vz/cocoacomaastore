"use client";

import { useQuery } from "@tanstack/react-query";
import { use, useMemo, useState } from "react";
import { DateSwitcher } from "@/components/ui/date-switcher";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section-heading";
import AuditLogList from "@/features/insights/audit-log-list";
import { ChartSlotDetail } from "@/features/insights/chart-slot-detail";
import { bestSlot, hasTrend, type RevenueSlot, slotStepper } from "@/features/insights/chart-slots";
import { insightsQueries, REPORT_DAY_PARAM } from "@/features/insights/client";
import { buildHourSlots } from "@/features/insights/hourly-sales";
import { HourlySalesChart } from "@/features/insights/hourly-sales-chart";
import { InsightsHeader } from "@/features/insights/insights-header";
import { averageOrderValue, KpiDelta, type KpiFigure, KpiSummary } from "@/features/insights/kpi-summary";
import { ChartCardSkeleton, RevenueChart } from "@/features/insights/revenue-chart";
import type { DashboardReport, DayTotals, Totals } from "@/features/insights/shapes";
import StockList from "@/features/insights/stock-list";
import { dayOrdersQuery } from "@/features/orders/client";
import { formatCount, formatDateShort, formatDayShort, formatINR, formatNumber, UNIT } from "@/lib/format";
import type { ServerSnapshot } from "@/lib/server-snapshot";
import { dayKeyParts, monthKeyOf } from "@/lib/shop-calendar";
import { useSeededQuery } from "@/lib/use-seeded-query";
import { useShopDay } from "@/lib/use-shop-day";

function daySlot(point: DayTotals): RevenueSlot {
	return {
		key: point.day,
		axisLabel: String(dayKeyParts(point.day).day),
		wideAxisLabel: formatDateShort(point.day),
		title: formatDayShort(point.day),
		revenue: point.revenue,
		orders: point.orders,
	};
}

/** "17–23 Nov", or "28 Oct–3 Nov" across a month boundary. */
function dayRangeLabel(trend: DayTotals[]): string {
	const first = trend[0]?.day;
	const last = trend.at(-1)?.day;
	if (!first || !last) return "";
	return monthKeyOf(first) === monthKeyOf(last)
		? `${dayKeyParts(first).day}–${formatDateShort(last)}`
		: `${formatDateShort(first)}–${formatDateShort(last)}`;
}

function change(current: number, previous: number): number | null {
	return previous > 0 ? (current - previous) / previous : null;
}

/**
 * The day's figures. A subline compares with the previous day, and only for a closed day: a
 * day still trading is never compared with a whole one. Items sold has no earlier figure.
 */
function dayFigures(report: DashboardReport) {
	const { totals } = report;
	const previous = report.isLive ? undefined : report.trend.at(-2);
	const comparable = previous && previous.orders > 0 && totals.orders > 0 ? previous : undefined;
	const delta = (figure: (day: Totals) => number, showPeriod = false) => {
		if (!comparable) return undefined;
		const ratio = change(figure(totals), figure(comparable));
		return ratio === null ? undefined : (
			<KpiDelta ratio={ratio} against={formatDayShort(comparable.day)} showPeriod={showPeriod} />
		);
	};

	const lead: KpiFigure = {
		label: "Revenue",
		value: formatINR(totals.revenue),
		detail: delta((day) => day.revenue, true),
	};
	const figures: KpiFigure[] = [
		{ label: "Orders", value: formatNumber(totals.orders), detail: delta((day) => day.orders) },
		{ label: "Items sold", value: formatNumber(totals.itemsSold) },
		{
			label: "Avg order value",
			value: formatINR(averageOrderValue(totals), { paise: "never" }),
			detail: delta(averageOrderValue),
		},
	];
	return { lead, figures };
}

/** Revenue by day for the week ending on the selected day, which starts selected so the chart and the figures above agree. */
function DayTrendChart({ report }: { report: DashboardReport }) {
	const slots = useMemo(() => report.trend.map(daySlot), [report.trend]);
	const [selectedKey, setSelectedKey] = useState<string>(report.day);
	const best = bestSlot(slots);
	const selected = slots.find((slot) => slot.key === selectedKey) ?? slots.at(-1) ?? null;

	return (
		<div className="surface-card p-4">
			<RevenueChart slots={slots} selectedKey={selected?.key ?? null} onSelect={setSelectedKey} />
			{selected ? (
				<ChartSlotDetail
					className="mt-4"
					title={selected.title}
					meta={selected.revenue > 0 ? formatCount(selected.orders, UNIT.order) : "No sales"}
					value={formatINR(selected.revenue)}
					note={selected.key === best?.key ? "Best day" : undefined}
					stepper={slotStepper(slots, selected, setSelectedKey, "day")}
				/>
			) : null}
		</div>
	);
}

/** Revenue by day when the week has a trend, otherwise the selected day by hour. */
function DaySalesSection({ report, isLoading }: { report: DashboardReport; isLoading: boolean }) {
	const showTrend = hasTrend(report.trend);
	const needsHours = !isLoading && !showTrend && report.totals.orders > 0;
	const ordersQuery = useQuery({ ...dayOrdersQuery(report.day), enabled: needsHours });
	const hourSlots = useMemo(() => buildHourSlots(ordersQuery.data?.orders ?? []), [ordersQuery.data]);

	if (showTrend || isLoading) {
		return (
			<section aria-labelledby="revenue-by-day">
				<SectionHeading
					id="revenue-by-day"
					title="Revenue by day"
					action={<span className="text-muted-foreground tabular-nums">{dayRangeLabel(report.trend)}</span>}
				/>
				{isLoading ? <ChartCardSkeleton /> : <DayTrendChart key={report.day} report={report} />}
			</section>
		);
	}

	return (
		<section aria-labelledby="sales-by-hour">
			<SectionHeading id="sales-by-hour" title="Sales by hour" />
			{report.totals.orders === 0 || (ordersQuery.isSuccess && hourSlots.length === 0) ? (
				<EmptyState description="No sales on this day." />
			) : ordersQuery.isError ? (
				<EmptyState description="Sales by hour didn't load." onRetry={() => ordersQuery.refetch()} />
			) : hourSlots.length === 0 ? (
				<ChartCardSkeleton />
			) : (
				<HourlySalesChart slots={hourSlots} />
			)}
		</section>
	);
}

/** Insights › Day: one shop day's figures, sales, stock and stock changes. */
export function DashboardContent({ report: reportPromise }: { report: Promise<ServerSnapshot<DashboardReport>> }) {
	const initialReport = use(reportPromise);
	const { day, today, setDay } = useShopDay(REPORT_DAY_PARAM, initialReport.data.today);
	const query = useSeededQuery(
		{ ...insightsQueries.day(day, today), placeholderData: (previous) => previous },
		day === initialReport.data.day ? initialReport : undefined,
	);
	const report = query.data;
	// Only a day still loading hides figures; a background refetch keeps the day's figures on screen.
	const showsOtherDay = query.isPlaceholderData;

	return (
		<div>
			<InsightsHeader>
				<DateSwitcher value={day} today={today} onChange={setDay} />
			</InsightsHeader>

			<div className="space-y-6">
				{query.isError ? (
					<EmptyState description={`${formatDayShort(day)} didn't load.`} onRetry={() => query.refetch()} />
				) : null}
				{report && !(query.isError && showsOtherDay) ? (
					<>
						<KpiSummary aria-label="Day summary" {...dayFigures(report)} isLoading={showsOtherDay} />
						<DaySalesSection report={report} isLoading={showsOtherDay} />
						<div className="grid gap-6 @3xl/main:grid-cols-2 @3xl/main:items-start">
							<StockList stock={report.stock} isLoading={showsOtherDay} />
							<AuditLogList day={report.day} log={report.stockChanges} isLoading={showsOtherDay} />
						</div>
					</>
				) : null}
			</div>
		</div>
	);
}
