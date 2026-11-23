import "server-only";

import { and, desc, eq, gte, lte } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { db } from "@/db";
import {
	analyticsDailyRevenueTable,
	analyticsMonthlyDessertRevenueTable,
	analyticsMonthlyRevenueTable,
	dessertsTable,
} from "@/db/schema";
import { requireAdmin } from "@/features/access/session";
import { itemsSold, salesTotals } from "@/features/insights/sales";
import {
	businessWeeks,
	businessWeeksRange,
	type DayRange,
	dayTrend,
	dayTrendRange,
	monthTrend,
} from "@/features/insights/series";
import type {
	AnalyticsOverview,
	BusinessWeekTotals,
	DashboardReport,
	DessertSales,
	Totals,
} from "@/features/insights/shapes";
import { COMPILED_TAGS, DESSERT_SALES_TAGS, dayReportTags, isLiveDay } from "@/features/insights/tags";
import { readDayStock, readStockChanges } from "@/features/inventory/daily-inventory";
import { TAGGED_READ_REVALIDATE_SECONDS } from "@/lib/cache-tags";
import {
	addDays,
	analyticsDate,
	type DayKey,
	dayEnd,
	dayKeyOf,
	dayKeyOfAnalyticsDate,
	dayStart,
	type MonthKey,
	monthKeyOf,
} from "@/lib/shop-calendar";

const STOCK_CHANGES_LIMIT = 50;

/** Revenue and orders for each compiled day in the range that has sales. */
async function readCompiledDayTotals({ first, last }: DayRange): Promise<Map<DayKey, Totals>> {
	if (first > last) return new Map();
	const rows = await db
		.select({
			day: analyticsDailyRevenueTable.day,
			revenue: analyticsDailyRevenueTable.grossRevenue,
			orders: analyticsDailyRevenueTable.orderCount,
		})
		.from(analyticsDailyRevenueTable)
		.where(
			and(
				gte(analyticsDailyRevenueTable.day, analyticsDate(first)),
				lte(analyticsDailyRevenueTable.day, analyticsDate(last)),
			),
		);
	return new Map(
		rows.map((row) => [dayKeyOfAnalyticsDate(row.day), { revenue: Number(row.revenue), orders: row.orders }]),
	);
}

/** Like {@link readCompiledDayTotals}, but `today`, if in range, is read live from the orders. */
async function readDayTotals({ first, last }: DayRange, today: DayKey): Promise<Map<DayKey, Totals>> {
	const lastClosed = last < today ? last : addDays(today, -1);
	const [totals, live] = await Promise.all([
		readCompiledDayTotals({ first, last: lastClosed }),
		first <= today && today <= last ? salesTotals(db, dayStart(today), dayEnd(today)) : null,
	]);
	if (live) totals.set(today, { revenue: Number(live.revenue), orders: live.orders });
	return totals;
}

async function readDashboardReport(day: DayKey, today: DayKey): Promise<Omit<DashboardReport, "today">> {
	const [totalsByDay, items, stock, stockChanges] = await Promise.all([
		readDayTotals(dayTrendRange(day), today),
		itemsSold(db, dayStart(day), dayEnd(day)),
		readDayStock(day),
		readStockChanges(day, STOCK_CHANGES_LIMIT),
	]);
	const trend = dayTrend(day, totalsByDay);
	const { revenue, orders } = trend[trend.length - 1];

	return {
		day,
		isLive: isLiveDay(day, today),
		totals: { revenue, orders, itemsSold: items },
		trend,
		stock,
		stockChanges,
	};
}

/** Insights › Day for `day` (default: today). */
export async function getDashboardReport(day?: DayKey): Promise<DashboardReport> {
	await requireAdmin();
	const today = dayKeyOf(new Date());
	const reportDay = day ?? today;
	const liveOn = isLiveDay(reportDay, today) ? today : "closed";

	const report = await unstable_cache(
		() => readDashboardReport(reportDay, today),
		["insights-day", reportDay, liveOn],
		{
			revalidate: TAGGED_READ_REVALIDATE_SECONDS,
			tags: dayReportTags(reportDay, today),
		},
	)();
	return { ...report, today };
}

/** Revenue by Business Week for one month, from its compiled days. */
export async function getBusinessWeekRevenue(month: MonthKey): Promise<BusinessWeekTotals[]> {
	await requireAdmin();
	return unstable_cache(
		async () => businessWeeks(month, await readCompiledDayTotals(businessWeeksRange(month))),
		["insights-weeks", month],
		{ revalidate: TAGGED_READ_REVALIDATE_SECONDS, tags: COMPILED_TAGS },
	)();
}

async function readCompiledMonths() {
	const rows = await db
		.select({
			month: analyticsMonthlyRevenueTable.month,
			revenue: analyticsMonthlyRevenueTable.grossRevenue,
			orders: analyticsMonthlyRevenueTable.orderCount,
		})
		.from(analyticsMonthlyRevenueTable)
		.orderBy(desc(analyticsMonthlyRevenueTable.month));

	return {
		months: monthTrend(rows.map((row) => ({ ...row, revenue: Number(row.revenue) }))),
		compiledMonths: rows.map((row) => row.month),
	};
}

/** Insights › Month: the monthly trend and the months that can be opened. */
export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
	await requireAdmin();
	const compiled = await unstable_cache(readCompiledMonths, ["insights-months"], {
		revalidate: TAGGED_READ_REVALIDATE_SECONDS,
		tags: COMPILED_TAGS,
	})();
	return { ...compiled, latestMonth: compiled.compiledMonths[0] ?? monthKeyOf(new Date()) };
}

async function readDessertSales(month: MonthKey): Promise<DessertSales[]> {
	const rows = await db
		.select({
			dessertId: analyticsMonthlyDessertRevenueTable.dessertId,
			dessertName: dessertsTable.name,
			revenue: analyticsMonthlyDessertRevenueTable.grossRevenue,
			quantitySold: analyticsMonthlyDessertRevenueTable.quantitySold,
		})
		.from(analyticsMonthlyDessertRevenueTable)
		.innerJoin(dessertsTable, eq(analyticsMonthlyDessertRevenueTable.dessertId, dessertsTable.id))
		.where(eq(analyticsMonthlyDessertRevenueTable.month, month))
		.orderBy(desc(analyticsMonthlyDessertRevenueTable.grossRevenue));

	return rows.map((row) => ({ ...row, revenue: Number(row.revenue) }));
}

/** Each dessert's compiled sales in one month, highest revenue first. */
export async function getDessertSales(month: MonthKey): Promise<DessertSales[]> {
	await requireAdmin();
	return unstable_cache(() => readDessertSales(month), ["insights-desserts", month], {
		revalidate: TAGGED_READ_REVALIDATE_SECONDS,
		tags: DESSERT_SALES_TAGS,
	})();
}
