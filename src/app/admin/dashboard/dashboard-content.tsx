"use client";

import { useQuery } from "@tanstack/react-query";
import { use, useCallback, useMemo, useState } from "react";
import AuditLogList from "@/components/admin/dashboard/audit-log-list";
import { countSalesSlots } from "@/components/admin/dashboard/bar-chart";
import { buildHourSlots } from "@/components/admin/dashboard/hourly-sales";
import { InsightsHeader } from "@/components/admin/dashboard/insights-header";
import RevenueChart, {
	ChartCardSkeleton,
	type DaySlot,
	HourlySalesChart,
} from "@/components/admin/dashboard/revenue-chart";
import { KpiDelta, type KpiFigure, KpiSummary } from "@/components/admin/dashboard/stats-card";
import StockList from "@/components/admin/dashboard/stock-list";
import { DateSwitcher } from "@/components/date-switcher";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { formatDateShort, formatDayShort, formatINR, formatNumber } from "@/lib/format";
import { formatLocalDateKey } from "@/lib/local-date";
import type { SerializedOrders } from "@/lib/order-lifecycle";
import type { AuditLogEntry, DailyRevenue, DashboardStats, DessertStock } from "./actions";

type DashboardContentProps = {
	stats: Promise<DashboardStats>;
	stock: Promise<DessertStock[]>;
	auditLogs: Promise<AuditLogEntry[]>;
	dailyRevenue: Promise<DailyRevenue[]>;
};

type DashboardData = {
	stats: DashboardStats;
	stock: DessertStock[];
	auditLogs: AuditLogEntry[];
	dailyRevenue: DailyRevenue[];
};

const TREND_DAYS = 7;

async function fetchDashboardData(dateString: string, signal?: AbortSignal): Promise<DashboardData> {
	const response = await fetch(`/api/admin/dashboard?date=${encodeURIComponent(dateString)}`, {
		cache: "no-store",
		signal,
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch dashboard data (${response.status})`);
	}

	return response.json();
}

/**
 * The same read the Orders page uses for a day (same URL and query key), so Sales by hour
 * shares its cache and adds no server query.
 */
async function fetchDayOrders(dateString: string, signal?: AbortSignal): Promise<SerializedOrders> {
	const response = await fetch(`/api/admin/orders?date=${encodeURIComponent(dateString)}`, {
		cache: "no-store",
		signal,
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch admin orders (${response.status})`);
	}

	return response.json();
}

/**
 * Every day of the 7-day window ending on `endKey`, so days without sales still get a slot.
 * The report only returns days that have analytics rows; they are matched by their label.
 */
function buildDaySlots(endKey: string, dailyRevenue: DailyRevenue[]): DaySlot[] {
	const byLabel = new Map(dailyRevenue.map((day) => [day.date, day]));
	const [year, month, day] = endKey.split("-").map(Number);

	return Array.from({ length: TREND_DAYS }, (_, index) => {
		const date = new Date(Date.UTC(year, month - 1, day - (TREND_DAYS - 1 - index)));
		const key = date.toISOString().slice(0, 10);
		const label = formatDateShort(key);
		const row = byLabel.get(label);
		return {
			key,
			axisLabel: String(date.getUTCDate()),
			title: label,
			revenue: row?.revenue ?? 0,
			orders: row?.orders ?? 0,
		};
	});
}

/** "17–23 Nov", or "28 Oct–3 Nov" across a month boundary. */
function dayRangeLabel(slots: DaySlot[]): string {
	const first = slots[0]?.key;
	const last = slots.at(-1)?.key;
	if (!first || !last) return "";
	return first.slice(0, 7) === last.slice(0, 7)
		? `${Number(first.slice(8))}–${formatDateShort(last)}`
		: `${formatDateShort(first)}–${formatDateShort(last)}`;
}

/** Change against the previous figure, or null when there is nothing to compare with. */
function change(current: number, previous: number): number | null {
	return previous > 0 ? (current - previous) / previous : null;
}

/**
 * The day's figures. A subline is a real comparison with the previous day, taken from the
 * 7-day series this read already returns, and only for a closed day: a day still trading
 * is never compared with a whole one. Items sold has no earlier figure, so no subline.
 */
function dayFigures(stats: DashboardStats, previous: DaySlot | undefined, compare: boolean) {
	const avgOrderValue = stats.dayOrdersCount > 0 ? stats.dayRevenue / stats.dayOrdersCount : 0;
	const canCompare = compare && previous !== undefined && previous.orders > 0 && stats.dayOrdersCount > 0;
	const against = previous ? formatDayShort(previous.key) : "";
	const delta = (current: number, earlier: number, showPeriod = false) => {
		const ratio = canCompare ? change(current, earlier) : null;
		return ratio === null ? undefined : <KpiDelta ratio={ratio} against={against} showPeriod={showPeriod} />;
	};

	const lead: KpiFigure = {
		label: "Revenue",
		value: formatINR(stats.dayRevenue),
		detail: delta(stats.dayRevenue, previous?.revenue ?? 0, true),
	};
	const figures: KpiFigure[] = [
		{
			label: "Orders",
			value: formatNumber(stats.dayOrdersCount),
			detail: delta(stats.dayOrdersCount, previous?.orders ?? 0),
		},
		{ label: "Items sold", value: formatNumber(stats.dayItemsSold) },
		{
			label: "Avg order value",
			value: formatINR(avgOrderValue, { paise: "never" }),
			detail: previous && previous.orders > 0 ? delta(avgOrderValue, previous.revenue / previous.orders) : undefined,
		},
	];
	return { lead, figures };
}

function DaySalesSection({
	daySlots,
	selectedDateString,
	dayOrdersCount,
	isLoading,
}: {
	daySlots: DaySlot[];
	selectedDateString: string;
	dayOrdersCount: number;
	isLoading: boolean;
}) {
	const showTrend = countSalesSlots(daySlots) >= 2;
	const needsHours = !isLoading && !showTrend && dayOrdersCount > 0;
	const ordersQuery = useQuery({
		queryKey: ["admin-orders", selectedDateString],
		queryFn: ({ signal }) => fetchDayOrders(selectedDateString, signal),
		enabled: needsHours,
		staleTime: 60_000,
		gcTime: 10 * 60_000,
	});
	const hourSlots = useMemo(() => buildHourSlots(ordersQuery.data ?? []), [ordersQuery.data]);

	if (showTrend || isLoading) {
		return (
			<section aria-labelledby="revenue-by-day">
				<SectionHeading
					id="revenue-by-day"
					title="Revenue by day"
					action={<span className="text-muted-foreground tabular-nums">{dayRangeLabel(daySlots)}</span>}
				/>
				{isLoading ? (
					<ChartCardSkeleton />
				) : (
					<RevenueChart key={selectedDateString} slots={daySlots} selectedDayKey={selectedDateString} />
				)}
			</section>
		);
	}

	return (
		<section aria-labelledby="sales-by-hour">
			<SectionHeading id="sales-by-hour" title="Sales by hour" />
			{dayOrdersCount === 0 || (ordersQuery.isSuccess && hourSlots.length === 0) ? (
				<EmptyState description="No sales on this day." />
			) : ordersQuery.isError ? (
				<EmptyState
					description="Sales by hour didn't load."
					action={
						<Button variant="outline" size="sm" onClick={() => ordersQuery.refetch()}>
							Try again
						</Button>
					}
				/>
			) : hourSlots.length === 0 ? (
				<ChartCardSkeleton />
			) : (
				<HourlySalesChart slots={hourSlots} />
			)}
		</section>
	);
}

export function DashboardContent({
	stats: statsPromise,
	stock: stockPromise,
	auditLogs: auditLogsPromise,
	dailyRevenue: dailyRevenuePromise,
}: DashboardContentProps) {
	const initialStats = use(statsPromise);
	const initialStock = use(stockPromise);
	const initialAuditLogs = use(auditLogsPromise);
	const initialDailyRevenue = use(dailyRevenuePromise);
	const [initialDateString] = useState(() => formatLocalDateKey(new Date()));
	const [selectedDate, setSelectedDate] = useState<Date>(() => {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d;
	});
	const selectedDateString = useMemo(() => formatLocalDateKey(selectedDate), [selectedDate]);
	const initialDashboardData = useMemo(
		() => ({
			stats: initialStats,
			stock: initialStock,
			auditLogs: initialAuditLogs,
			dailyRevenue: initialDailyRevenue,
		}),
		[initialStats, initialStock, initialAuditLogs, initialDailyRevenue],
	);
	const {
		data: queriedDashboardData,
		error,
		isFetching,
	} = useQuery({
		queryKey: ["admin-dashboard", selectedDateString],
		queryFn: ({ signal }) => fetchDashboardData(selectedDateString, signal),
		initialData: selectedDateString === initialDateString ? initialDashboardData : undefined,
		placeholderData: (previousData) => previousData,
	});

	const handleDateChange = useCallback((date: Date) => {
		setSelectedDate(date);
	}, []);

	if (error) {
		console.error("Failed to fetch dashboard data:", error);
	}

	const dashboardData = queriedDashboardData ?? initialDashboardData;
	const { stats, stock, auditLogs, dailyRevenue } = dashboardData;
	const isLoading = isFetching;
	const daySlots = useMemo(() => buildDaySlots(selectedDateString, dailyRevenue), [selectedDateString, dailyRevenue]);
	const isLiveDay = selectedDateString === formatLocalDateKey(new Date());
	const { lead, figures } = dayFigures(stats, daySlots.at(-2), !isLiveDay);

	return (
		<div>
			<InsightsHeader>
				<DateSwitcher selectedDate={selectedDate} onDateChange={handleDateChange} />
			</InsightsHeader>

			<div className="space-y-6">
				<KpiSummary aria-label="Day summary" lead={lead} figures={figures} isLoading={isLoading} />

				<DaySalesSection
					daySlots={daySlots}
					selectedDateString={selectedDateString}
					dayOrdersCount={stats.dayOrdersCount}
					isLoading={isLoading}
				/>

				<div className="grid gap-6 @3xl/main:grid-cols-2 @3xl/main:items-start">
					<StockList stock={stock} isLoading={isLoading} />
					<AuditLogList logs={auditLogs} isLoading={isLoading} />
				</div>
			</div>
		</div>
	);
}
