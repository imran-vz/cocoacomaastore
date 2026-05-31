import "server-only";

import { performance } from "node:perf_hooks";
import { and, desc, eq, gte, lt, lte, sql, sum } from "drizzle-orm";
import { unstable_cache as next_unstable_cache } from "next/cache";

import { db } from "@/db";
import {
	analyticsDailyDessertRevenueTable,
	analyticsDailyEodStockTable,
	analyticsDailyRevenueTable,
	analyticsMonthlyDessertRevenueTable,
	analyticsMonthlyRevenueTable,
	dailyDessertInventoryTable,
	dessertsTable,
	inventoryAuditLogTable,
	ordersTable,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import {
	getAnalyticsDay,
	getDayKey,
	getEndOfDayIST,
	getISTMonthKey,
	getStartOfDayIST,
	pgTimestamp,
} from "@/lib/ist-date";
import { DashboardTags } from "@/server/effect/cache-tags";
import type {
	AdminAnalyticsReport,
	AdminDashboardReport,
	AuditLogEntry,
	DailyEodStock,
	DailyRevenue,
	DashboardStats,
	DessertStock,
	MonthlyDessertRevenue,
	MonthlyRevenue,
	WeeklyRevenue,
} from "./shapes";

// biome-ignore lint/suspicious/noExplicitAny: for next unstable_cache
type Callback = (...args: any[]) => Promise<any>;
function timestampParam(date: Date) {
	return sql`${pgTimestamp(date)}::timestamp`;
}

function unstable_cache<T extends Callback>(
	cb: T,
	keyParts?: string[],
	options?: {
		revalidate?: number | false;
		tags?: readonly string[];
	},
): T {
	if (process.env.NODE_ENV === "development") {
		return cb;
	}

	return next_unstable_cache(cb, keyParts, options as { revalidate?: number | false; tags?: string[] });
}
export const ADMIN_REPORTING_TAGS = DashboardTags;

// Get dashboard stats for a specific day
async function getDashboardStats(date: Date): Promise<DashboardStats> {
	const start = performance.now();
	const analyticsDay = getAnalyticsDay(date);
	const currentAnalyticsDay = getAnalyticsDay(new Date());
	const isCurrentISTDay = analyticsDay.getTime() === currentAnalyticsDay.getTime();
	const weekStart = new Date(analyticsDay);
	weekStart.setDate(weekStart.getDate() - 6);
	const analyticsDayParam = timestampParam(analyticsDay);
	const weekStartParam = timestampParam(weekStart);

	if (!isCurrentISTDay) {
		const [dayRevenueRow, dayItemsRow, weekStats] = await Promise.all([
			db
				.select({
					count: analyticsDailyRevenueTable.orderCount,
					revenue: analyticsDailyRevenueTable.grossRevenue,
				})
				.from(analyticsDailyRevenueTable)
				.where(eq(analyticsDailyRevenueTable.day, analyticsDayParam))
				.limit(1),
			db
				.select({
					itemsSold: sum(analyticsDailyDessertRevenueTable.quantitySold).as("itemsSold"),
				})
				.from(analyticsDailyDessertRevenueTable)
				.where(eq(analyticsDailyDessertRevenueTable.day, analyticsDayParam)),
			db
				.select({
					count: sum(analyticsDailyRevenueTable.orderCount).as("count"),
					revenue: sum(analyticsDailyRevenueTable.grossRevenue).as("revenue"),
				})
				.from(analyticsDailyRevenueTable)
				.where(
					and(
						gte(analyticsDailyRevenueTable.day, weekStartParam),
						lte(analyticsDailyRevenueTable.day, analyticsDayParam),
					),
				),
		]);

		const duration = performance.now() - start;
		console.log(`getDashboardStats: ${duration.toFixed(2)}ms`);

		return {
			dayOrdersCount: dayRevenueRow[0]?.count ?? 0,
			dayRevenue: Number(dayRevenueRow[0]?.revenue ?? 0),
			dayItemsSold: Number(dayItemsRow[0]?.itemsSold ?? 0),
			weekOrdersCount: Number(weekStats[0]?.count ?? 0),
			weekRevenue: Number(weekStats[0]?.revenue ?? 0),
		};
	}

	const dayStartIST = getStartOfDayIST(date);
	const dayEndIST = getEndOfDayIST(date);
	const dayStartISTParam = timestampParam(dayStartIST);
	const dayEndISTParam = timestampParam(dayEndIST);
	const currentAnalyticsDayParam = timestampParam(currentAnalyticsDay);

	const [todayOrders, todayItems, weekStats] = await Promise.all([
		db
			.select({
				count: sql<number>`count(*)::int`,
				revenue: sql<string>`coalesce(sum(total), 0)`,
			})
			.from(ordersTable)
			.where(
				and(
					eq(ordersTable.status, "completed"),
					eq(ordersTable.isDeleted, false),
					gte(ordersTable.createdAt, dayStartISTParam),
					lt(ordersTable.createdAt, dayEndISTParam),
				),
			),
		db.execute<{ totalItems: number }>(sql`
			WITH filtered_orders AS MATERIALIZED (
				SELECT id
				FROM orders
				WHERE status = 'completed'
					AND "isDeleted" = false
					AND "createdAt" >= ${pgTimestamp(dayStartIST)}::timestamp
					AND "createdAt" < ${pgTimestamp(dayEndIST)}::timestamp
			)
			SELECT coalesce(sum(item_totals.quantity), 0)::int AS "totalItems"
			FROM filtered_orders o
			CROSS JOIN LATERAL (
				SELECT sum(quantity) AS quantity
				FROM order_items oi
				WHERE oi."orderId" = o.id
			) item_totals
		`),
		db
			.select({
				count: sum(analyticsDailyRevenueTable.orderCount).as("count"),
				revenue: sum(analyticsDailyRevenueTable.grossRevenue).as("revenue"),
			})
			.from(analyticsDailyRevenueTable)
			.where(
				and(
					gte(analyticsDailyRevenueTable.day, weekStartParam),
					lt(analyticsDailyRevenueTable.day, currentAnalyticsDayParam),
				),
			),
	]);

	const dayOrdersCount = todayOrders[0]?.count ?? 0;
	const dayRevenue = Number(todayOrders[0]?.revenue ?? 0);
	const dayItemsSold = todayItems[0]?.totalItems ?? 0;
	const weekOrdersCount = Number(weekStats[0]?.count ?? 0) + dayOrdersCount;
	const weekRevenue = Number(weekStats[0]?.revenue ?? 0) + dayRevenue;

	const duration = performance.now() - start;
	console.log(`getDashboardStats: ${duration.toFixed(2)}ms`);

	return {
		dayOrdersCount,
		dayRevenue,
		dayItemsSold,
		weekOrdersCount,
		weekRevenue,
	};
}

// Get stock per dessert for a specific day
async function getStockPerDessert(day: Date): Promise<DessertStock[]> {
	const start = performance.now();

	const dayStart = getAnalyticsDay(day);
	const dayStartParam = timestampParam(dayStart);

	const desserts = await db
		.select({
			id: dessertsTable.id,
			name: dessertsTable.name,
			hasUnlimitedStock: dessertsTable.hasUnlimitedStock,
			enabled: dessertsTable.enabled,
			currentStock: sql<number>`coalesce(${dailyDessertInventoryTable.quantity}, 0)::int`,
		})
		.from(dessertsTable)
		.leftJoin(
			dailyDessertInventoryTable,
			and(
				eq(dailyDessertInventoryTable.dessertId, dessertsTable.id),
				eq(dailyDessertInventoryTable.day, dayStartParam),
			),
		)
		.where(eq(dessertsTable.isDeleted, false))
		.orderBy(dessertsTable.sequence);

	const duration = performance.now() - start;
	console.log(`getStockPerDessert: ${duration.toFixed(2)}ms`);

	return desserts;
}

// Get audit logs for a specific day
async function getAuditLogs(date: Date, limit = 50): Promise<AuditLogEntry[]> {
	const start = performance.now();

	const dayStart = getStartOfDayIST(date);
	const dayEnd = getEndOfDayIST(date);
	const dayStartParam = timestampParam(dayStart);
	const dayEndParam = timestampParam(dayEnd);

	const logs = await db
		.select({
			id: inventoryAuditLogTable.id,
			day: inventoryAuditLogTable.day,
			dessertName: dessertsTable.name,
			action: inventoryAuditLogTable.action,
			previousQuantity: inventoryAuditLogTable.previousQuantity,
			newQuantity: inventoryAuditLogTable.newQuantity,
			orderId: inventoryAuditLogTable.orderId,
			createdAt: inventoryAuditLogTable.createdAt,
			note: inventoryAuditLogTable.note,
		})
		.from(inventoryAuditLogTable)
		.innerJoin(dessertsTable, eq(inventoryAuditLogTable.dessertId, dessertsTable.id))
		.where(and(gte(inventoryAuditLogTable.createdAt, dayStartParam), lt(inventoryAuditLogTable.createdAt, dayEndParam)))
		.orderBy(desc(inventoryAuditLogTable.createdAt))
		.limit(limit);

	const duration = performance.now() - start;
	console.log(`getAuditLogs: ${duration.toFixed(2)}ms`);

	// Serialize Date objects to ISO strings for client transfer
	return logs.map((log) => ({
		...log,
		day: log.day.toISOString(),
		createdAt: log.createdAt.toISOString(),
	}));
}

// Get daily revenue for the past N days ending on a specific date (for chart)
async function getMissingDailyRevenueDays(endDate: Date, days = 7): Promise<string[]> {
	const endDay = getAnalyticsDay(endDate);
	const today = getAnalyticsDay(new Date());
	const analyticsEndDay = endDay.getTime() === today.getTime() ? new Date(endDay.getTime() - 86_400_000) : endDay;
	const startDay = new Date(endDay);
	startDay.setDate(startDay.getDate() - (days - 1));

	if (analyticsEndDay < startDay) return [];

	const results = await db
		.select({ day: analyticsDailyRevenueTable.day })
		.from(analyticsDailyRevenueTable)
		.where(
			and(
				gte(analyticsDailyRevenueTable.day, timestampParam(startDay)),
				lte(analyticsDailyRevenueTable.day, timestampParam(analyticsEndDay)),
			),
		);
	const present = new Set(results.map((row) => row.day.toISOString().slice(0, 10)));
	const missing: string[] = [];

	for (const day = new Date(startDay); day <= analyticsEndDay; day.setUTCDate(day.getUTCDate() + 1)) {
		const key = day.toISOString().slice(0, 10);
		if (!present.has(key)) missing.push(key);
	}

	return missing;
}

async function getDailyRevenue(endDate: Date, days = 7): Promise<DailyRevenue[]> {
	const start = performance.now();

	const endDay = getAnalyticsDay(endDate);
	const startDay = new Date(endDay);
	startDay.setDate(startDay.getDate() - (days - 1));
	const startDayParam = timestampParam(startDay);

	// Check if endDate is today in IST
	const todayUTC = getAnalyticsDay(new Date());
	const isEndDateToday = endDay.getTime() === todayUTC.getTime();

	// Query analytics for historical days (exclude today if it's in range)
	const analyticsEndDay = isEndDateToday ? new Date(endDay.getTime() - 24 * 60 * 60 * 1000) : endDay;
	const analyticsEndDayParam = timestampParam(analyticsEndDay);

	const results = await db
		.select({
			day: analyticsDailyRevenueTable.day,
			revenue: analyticsDailyRevenueTable.grossRevenue,
			orders: analyticsDailyRevenueTable.orderCount,
		})
		.from(analyticsDailyRevenueTable)
		.where(
			and(
				gte(analyticsDailyRevenueTable.day, startDayParam),
				lte(analyticsDailyRevenueTable.day, analyticsEndDayParam),
			),
		)
		.orderBy(analyticsDailyRevenueTable.day);

	const dailyData: DailyRevenue[] = results.map((r) => ({
		date: new Date(r.day).toLocaleDateString("en-IN", {
			day: "numeric",
			month: "short",
			timeZone: "Asia/Kolkata",
		}),
		revenue: Number(r.revenue),
		orders: r.orders,
	}));

	// If endDate is today, fetch live data from orders table
	if (isEndDateToday) {
		const dayStartIST = getStartOfDayIST(endDate);
		const dayEndIST = getEndOfDayIST(endDate);
		const dayStartISTParam = timestampParam(dayStartIST);
		const dayEndISTParam = timestampParam(dayEndIST);

		const [todayData] = await db
			.select({
				count: sql<number>`count(*)::int`,
				revenue: sql<string>`coalesce(sum(total), 0)`,
			})
			.from(ordersTable)
			.where(
				and(
					eq(ordersTable.status, "completed"),
					eq(ordersTable.isDeleted, false),
					gte(ordersTable.createdAt, dayStartISTParam),
					lt(ordersTable.createdAt, dayEndISTParam),
				),
			);

		// Add today's data to the results
		dailyData.push({
			date: new Date(todayUTC).toLocaleDateString("en-IN", {
				day: "numeric",
				month: "short",
				timeZone: "Asia/Kolkata",
			}),
			revenue: Number(todayData?.revenue ?? 0),
			orders: todayData?.count ?? 0,
		});
	}

	const duration = performance.now() - start;
	console.log(`getDailyRevenue: ${duration.toFixed(2)}ms`);

	return dailyData;
}

// Cached exports with date parameter
export async function getCachedDashboardStats(dateString?: string) {
	await requireAdmin();
	const date = dateString ? new Date(dateString) : new Date();
	const dayKey = getDayKey(date);

	return unstable_cache(() => getDashboardStats(date), ["dashboard-stats", dayKey], {
		revalidate: 60, // Revalidate every minute
		tags: ["orders", "dashboard"],
	})();
}

export async function getCachedStockPerDessert(dateString?: string) {
	await requireAdmin();
	const date = dateString ? new Date(dateString) : new Date();
	const day = getAnalyticsDay(date);
	const dayKey = getDayKey(date);

	return unstable_cache(() => getStockPerDessert(day), ["stock-per-dessert", dayKey], {
		revalidate: 60,
		tags: ["inventory", "desserts", "dashboard"],
	})();
}

export async function getCachedAuditLogs(dateString?: string) {
	await requireAdmin();
	const date = dateString ? new Date(dateString) : new Date();
	const dayKey = getDayKey(date);

	return unstable_cache(() => getAuditLogs(date), ["audit-logs", dayKey], {
		revalidate: 60,
		tags: DashboardTags.auditLogs,
	})();
}

export async function getCachedDailyRevenue(dateString?: string) {
	await requireAdmin();
	const date = dateString ? new Date(dateString) : new Date();
	const dayKey = getDayKey(date);

	return unstable_cache(() => getDailyRevenue(date, 7), ["daily-revenue", dayKey], {
		revalidate: 60 * 5, // Revalidate every 5 minutes
		tags: ["orders", "dashboard"],
	})();
}

// Get monthly revenue for the past N months
async function getMonthlyRevenue(months = 6): Promise<MonthlyRevenue[]> {
	const start = performance.now();

	const results = await db
		.select({
			month: analyticsMonthlyRevenueTable.month,
			grossRevenue: analyticsMonthlyRevenueTable.grossRevenue,
			orderCount: analyticsMonthlyRevenueTable.orderCount,
		})
		.from(analyticsMonthlyRevenueTable)
		.orderBy(desc(analyticsMonthlyRevenueTable.month))
		.limit(months);

	const duration = performance.now() - start;
	console.log(`getMonthlyRevenue: ${duration.toFixed(2)}ms`);

	return results.reverse().map((r) => ({
		month: r.month,
		grossRevenue: Number(r.grossRevenue),
		orderCount: r.orderCount,
	}));
}

export async function getCachedMonthlyRevenue(months = 6) {
	await requireAdmin();
	return unstable_cache(() => getMonthlyRevenue(months), ["monthly-revenue", String(months)], {
		revalidate: 60 * 60, // Revalidate every hour
		tags: DashboardTags.monthlyRevenue,
	})();
}

function isValidMonthKey(month: string): boolean {
	return /^\d{4}-\d{2}$/.test(month);
}

function formatWeekDate(month: string, day: number): string {
	const [year, monthNum] = month.split("-").map(Number);
	return new Date(Date.UTC(year, monthNum - 1, day)).toLocaleDateString("en-IN", {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
}

async function getWeeklyRevenue(month: string): Promise<WeeklyRevenue[]> {
	const start = performance.now();

	if (!isValidMonthKey(month)) {
		throw new Error("Invalid month");
	}

	const [year, monthNum] = month.split("-").map(Number);
	const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
	const monthStart = new Date(Date.UTC(year, monthNum - 1, 1));
	const nextMonthStart = new Date(Date.UTC(year, monthNum, 1));
	const monthStartParam = timestampParam(monthStart);
	const nextMonthStartParam = timestampParam(nextMonthStart);
	const todayUTC = getAnalyticsDay(new Date());
	const isCurrentMonth = getISTMonthKey() === month;
	const analyticsEndParam = isCurrentMonth ? timestampParam(todayUTC) : nextMonthStartParam;

	const results = await db
		.select({
			day: analyticsDailyRevenueTable.day,
			revenue: analyticsDailyRevenueTable.grossRevenue,
			orders: analyticsDailyRevenueTable.orderCount,
		})
		.from(analyticsDailyRevenueTable)
		.where(
			and(gte(analyticsDailyRevenueTable.day, monthStartParam), lt(analyticsDailyRevenueTable.day, analyticsEndParam)),
		)
		.orderBy(analyticsDailyRevenueTable.day);

	const dailyRows = results.map((row) => ({
		day: row.day,
		revenue: Number(row.revenue),
		orders: row.orders,
	}));

	if (isCurrentMonth) {
		const dayStartIST = getStartOfDayIST(new Date());
		const dayEndIST = getEndOfDayIST(new Date());
		const dayStartISTParam = timestampParam(dayStartIST);
		const dayEndISTParam = timestampParam(dayEndIST);

		const [todayData] = await db
			.select({
				count: sql<number>`count(*)::int`,
				revenue: sql<string>`coalesce(sum(total), 0)`,
			})
			.from(ordersTable)
			.where(
				and(
					eq(ordersTable.status, "completed"),
					eq(ordersTable.isDeleted, false),
					gte(ordersTable.createdAt, dayStartISTParam),
					lt(ordersTable.createdAt, dayEndISTParam),
				),
			);

		dailyRows.push({
			day: todayUTC,
			revenue: Number(todayData?.revenue ?? 0),
			orders: todayData?.count ?? 0,
		});
	}

	const weeks: WeeklyRevenue[] = [];
	const weekByDay = new Map<string, WeeklyRevenue>();
	let currentWeek: WeeklyRevenue | null = null;

	for (let day = 1; day <= daysInMonth; day++) {
		const date = new Date(Date.UTC(year, monthNum - 1, day));
		const dayOfWeek = date.getUTCDay();
		const isMonday = dayOfWeek === 1;
		const isTuesday = dayOfWeek === 2;

		if (isMonday) {
			currentWeek = null;
			continue;
		}

		if (!currentWeek || isTuesday) {
			currentWeek = {
				week: `Business Week ${weeks.length + 1}`,
				startDate: formatWeekDate(month, day),
				endDate: formatWeekDate(month, day),
				grossRevenue: 0,
				orderCount: 0,
			};
			weeks.push(currentWeek);
		}

		currentWeek.endDate = formatWeekDate(month, day);
		weekByDay.set(date.toISOString().slice(0, 10), currentWeek);
	}

	for (const row of dailyRows) {
		if (row.day < monthStart || row.day >= nextMonthStart) continue;

		const week = weekByDay.get(row.day.toISOString().slice(0, 10));
		if (!week) continue;

		week.grossRevenue += row.revenue;
		week.orderCount += row.orders;
	}

	const duration = performance.now() - start;
	console.log(`getWeeklyRevenue: ${duration.toFixed(2)}ms`);

	return weeks;
}

export async function getCachedWeeklyRevenue(month: string) {
	await requireAdmin();
	return unstable_cache(() => getWeeklyRevenue(month), ["weekly-revenue", month], {
		revalidate: 60 * 60,
		tags: DashboardTags.monthlyRevenue,
	})();
}

// Get monthly per-dessert revenue for a specific month
async function getMonthlyDessertRevenue(month?: string): Promise<MonthlyDessertRevenue[]> {
	const start = performance.now();

	// Default to current month if not specified
	const targetMonth =
		month ||
		(() => {
			return getISTMonthKey();
		})();

	const results = await db
		.select({
			month: analyticsMonthlyDessertRevenueTable.month,
			dessertId: analyticsMonthlyDessertRevenueTable.dessertId,
			dessertName: dessertsTable.name,
			grossRevenue: analyticsMonthlyDessertRevenueTable.grossRevenue,
			quantitySold: analyticsMonthlyDessertRevenueTable.quantitySold,
			orderCount: analyticsMonthlyDessertRevenueTable.orderCount,
		})
		.from(analyticsMonthlyDessertRevenueTable)
		.innerJoin(dessertsTable, eq(analyticsMonthlyDessertRevenueTable.dessertId, dessertsTable.id))
		.where(eq(analyticsMonthlyDessertRevenueTable.month, targetMonth))
		.orderBy(desc(analyticsMonthlyDessertRevenueTable.grossRevenue));

	const duration = performance.now() - start;
	console.log(`getMonthlyDessertRevenue: ${duration.toFixed(2)}ms`);

	return results.map((r) => ({
		month: r.month,
		dessertId: r.dessertId,
		dessertName: r.dessertName,
		grossRevenue: Number(r.grossRevenue),
		quantitySold: r.quantitySold,
		orderCount: r.orderCount,
	}));
}

export async function getCachedMonthlyDessertRevenue(month?: string) {
	await requireAdmin();
	const targetMonth =
		month ||
		(() => {
			return getISTMonthKey();
		})();

	return unstable_cache(() => getMonthlyDessertRevenue(targetMonth), ["monthly-dessert-revenue", targetMonth], {
		revalidate: 60 * 60, // Revalidate every hour
		tags: ["orders", "analytics", "desserts"],
	})();
}

// Get EOD stock trends for the past N days for all desserts
async function getEodStockTrends(days = 14): Promise<DailyEodStock[]> {
	const start = performance.now();

	const endDay = getAnalyticsDay(new Date());
	const startDay = new Date(endDay);
	startDay.setDate(startDay.getDate() - (days - 1));
	const endDayParam = timestampParam(endDay);
	const startDayParam = timestampParam(startDay);

	const results = await db
		.select({
			day: analyticsDailyEodStockTable.day,
			dessertId: analyticsDailyEodStockTable.dessertId,
			dessertName: dessertsTable.name,
			initialStock: analyticsDailyEodStockTable.initialStock,
			remainingStock: analyticsDailyEodStockTable.remainingStock,
		})
		.from(analyticsDailyEodStockTable)
		.innerJoin(dessertsTable, eq(analyticsDailyEodStockTable.dessertId, dessertsTable.id))
		.where(and(gte(analyticsDailyEodStockTable.day, startDayParam), lte(analyticsDailyEodStockTable.day, endDayParam)))
		.orderBy(analyticsDailyEodStockTable.day, dessertsTable.name);

	const duration = performance.now() - start;
	console.log(`getEodStockTrends: ${duration.toFixed(2)}ms`);

	return results.map((r) => ({
		day: r.day.toISOString().split("T")[0],
		dessertId: r.dessertId,
		dessertName: r.dessertName,
		initialStock: r.initialStock,
		remainingStock: r.remainingStock,
	}));
}

export async function getCachedEodStockTrends(days = 14) {
	await requireAdmin();
	const dayKey = getDayKey(new Date());

	return unstable_cache(() => getEodStockTrends(days), ["eod-stock-trends", dayKey, String(days)], {
		revalidate: 60 * 60, // Revalidate every hour
		tags: DashboardTags.eodStock,
	})();
}

// Get list of available months for analytics
async function getAvailableMonths(): Promise<string[]> {
	const results = await db
		.select({
			month: analyticsMonthlyRevenueTable.month,
		})
		.from(analyticsMonthlyRevenueTable)
		.orderBy(desc(analyticsMonthlyRevenueTable.month));

	return results.map((r) => r.month);
}

export async function getCachedAvailableMonths() {
	await requireAdmin();
	return unstable_cache(() => getAvailableMonths(), ["available-months"], {
		revalidate: 60 * 60 * 24, // Revalidate daily
		tags: DashboardTags.availableMonths,
	})();
}

async function getDashboardReport(dateString?: string): Promise<AdminDashboardReport> {
	const date = dateString ? new Date(dateString) : new Date();
	const dayKey = getDayKey(date);

	return unstable_cache(
		async () => {
			const [stats, stock, auditLogs, dailyRevenue, missingDays] = await Promise.all([
				getDashboardStats(date),
				getStockPerDessert(date),
				getAuditLogs(date),
				getDailyRevenue(date, 7),
				getMissingDailyRevenueDays(date, 7),
			]);

			return {
				stats,
				stock,
				auditLogs,
				dailyRevenue,
				analyticsState: { missingDays },
			};
		},
		["admin-dashboard-report", dayKey],
		{
			revalidate: 60,
			tags: [
				...ADMIN_REPORTING_TAGS.stats,
				...ADMIN_REPORTING_TAGS.stock,
				...ADMIN_REPORTING_TAGS.auditLogs,
				...ADMIN_REPORTING_TAGS.dailyRevenue,
			],
		},
	)();
}

export async function getAdminDashboardReport(dateString?: string): Promise<AdminDashboardReport> {
	await requireAdmin();
	return getDashboardReport(dateString);
}

async function getAnalyticsReport(month?: string): Promise<AdminAnalyticsReport> {
	const availableMonths = await getAvailableMonths();
	const initialMonth = month ?? (availableMonths.length > 0 ? availableMonths[0] : getISTMonthKey());
	const [monthlyRevenue, monthlyDessertRevenue] = await Promise.all([
		getMonthlyRevenue(12),
		getMonthlyDessertRevenue(initialMonth),
	]);

	return { monthlyRevenue, monthlyDessertRevenue, availableMonths, initialMonth };
}

export async function getAdminAnalyticsReport(month?: string): Promise<AdminAnalyticsReport> {
	await requireAdmin();
	return unstable_cache(() => getAnalyticsReport(month), ["admin-analytics-report", month ?? "latest"], {
		revalidate: 60 * 60,
		tags: [
			...ADMIN_REPORTING_TAGS.monthlyRevenue,
			...ADMIN_REPORTING_TAGS.monthlyDessertRevenue,
			...ADMIN_REPORTING_TAGS.availableMonths,
		],
	})();
}
