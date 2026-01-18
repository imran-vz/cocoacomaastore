"use server";

import { performance } from "node:perf_hooks";
import { and, desc, eq, gte, lt, lte, sql, sum } from "drizzle-orm";
import { unstable_cache as next_unstable_cache } from "next/cache";

import { db } from "@/db";
import {
	analyticsDailyRevenueTable,
	dailyDessertInventoryTable,
	dessertsTable,
	inventoryAuditLogTable,
	orderItemsTable,
	ordersTable,
} from "@/db/schema";

// biome-ignore lint/suspicious/noExplicitAny: for next unstable_cache
type Callback = (...args: any[]) => Promise<any>;
function unstable_cache<T extends Callback>(
	cb: T,
	keyParts?: string[],
	options?: {
		revalidate?: number | false;
		tags?: string[];
	},
): T {
	if (process.env.NODE_ENV === "development") {
		return cb;
	}

	return next_unstable_cache(cb, keyParts, options);
}
// IST is UTC+5:30
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Get the IST date components for a given Date object
function getISTDateParts(date: Date = new Date()) {
	const istTime = new Date(date.getTime() + IST_OFFSET_MS);
	return {
		year: istTime.getUTCFullYear(),
		month: istTime.getUTCMonth(),
		day: istTime.getUTCDate(),
	};
}

// Get IST midnight as a UTC timestamp (for querying orders by IST business day)
function getStartOfDayIST(date: Date = new Date()) {
	const ist = getISTDateParts(date);
	// Create IST midnight, then subtract IST offset to get UTC
	const istMidnight = Date.UTC(ist.year, ist.month, ist.day, 0, 0, 0, 0);
	return new Date(istMidnight - IST_OFFSET_MS);
}

// Get IST end of day as a UTC timestamp (for querying orders by IST business day)
function getEndOfDayIST(date: Date = new Date()) {
	const ist = getISTDateParts(date);
	// Create IST 23:59:59.999, then subtract IST offset to get UTC
	const istEndOfDay = Date.UTC(ist.year, ist.month, ist.day, 23, 59, 59, 999);
	return new Date(istEndOfDay - IST_OFFSET_MS);
}

// Get UTC midnight for the IST date (for analytics day column which stores UTC midnight)
function getStartOfDayUTC(date: Date = new Date()) {
	const ist = getISTDateParts(date);
	return new Date(Date.UTC(ist.year, ist.month, ist.day, 0, 0, 0, 0));
}

function getDayKey(date: Date = new Date()) {
	const ist = getISTDateParts(date);
	const y = ist.year;
	const m = String(ist.month + 1).padStart(2, "0");
	const d = String(ist.day).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

// Types
export type DashboardStats = {
	dayOrdersCount: number;
	dayRevenue: number;
	dayItemsSold: number;
	weekOrdersCount: number;
	weekRevenue: number;
};

export type DessertStock = {
	id: number;
	name: string;
	currentStock: number;
	hasUnlimitedStock: boolean;
	enabled: boolean;
};

export type AuditLogEntry = {
	id: number;
	day: string;
	action: string;
	previousQuantity: number;
	newQuantity: number;
	orderId: number | null;
	createdAt: string;
	note: string | null;
	dessertName: string;
};

// Get dashboard stats for a specific day
async function getDashboardStats(date: Date): Promise<DashboardStats> {
	const start = performance.now();

	// For today's data, query live orders table using IST time range
	const dayStartIST = getStartOfDayIST(date);
	const dayEndIST = getEndOfDayIST(date);

	// For analytics (past 6 days + today = 7 days total), use UTC midnight
	const dayStartUTC = getStartOfDayUTC(date);
	const weekAgoUTC = new Date(dayStartUTC);
	weekAgoUTC.setDate(weekAgoUTC.getDate() - 6);

	// Today's stats from live orders table
	const [todayOrders, todayItems, weekStats] = await Promise.all([
		// Today's order count and revenue from orders table
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
					gte(ordersTable.createdAt, dayStartIST),
					lte(ordersTable.createdAt, dayEndIST),
				),
			),

		// Today's items sold from order_items (only completed orders)
		db
			.select({
				totalItems: sql<number>`coalesce(sum(${orderItemsTable.quantity}), 0)::int`,
			})
			.from(orderItemsTable)
			.leftJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
			.where(
				and(
					eq(ordersTable.status, "completed"),
					eq(ordersTable.isDeleted, false),
					gte(ordersTable.createdAt, dayStartIST),
					lte(ordersTable.createdAt, dayEndIST),
				),
			),

		// Week stats (past 7 days, excluding today) from analytics table
		db
			.select({
				count: sum(analyticsDailyRevenueTable.orderCount).as("count"),
				revenue: sum(analyticsDailyRevenueTable.grossRevenue).as("revenue"),
			})
			.from(analyticsDailyRevenueTable)
			.where(
				and(
					gte(analyticsDailyRevenueTable.day, weekAgoUTC),
					lt(analyticsDailyRevenueTable.day, dayStartUTC),
				),
			),
	]);

	const dayOrdersCount = todayOrders[0]?.count ?? 0;
	const dayRevenue = Number(todayOrders[0]?.revenue ?? 0);
	const dayItemsSold = todayItems[0]?.totalItems ?? 0;

	// Combine today's data with past 7 days from analytics
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

	const dayStart = getStartOfDayUTC(day);

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
				eq(dailyDessertInventoryTable.day, dayStart),
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
		.innerJoin(
			dessertsTable,
			eq(inventoryAuditLogTable.dessertId, dessertsTable.id),
		)
		.where(
			and(
				gte(inventoryAuditLogTable.createdAt, dayStart),
				lt(inventoryAuditLogTable.createdAt, dayEnd),
			),
		)
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
export type DailyRevenue = {
	date: string;
	revenue: number;
	orders: number;
};

async function getDailyRevenue(
	endDate: Date,
	days = 7,
): Promise<DailyRevenue[]> {
	const start = performance.now();

	const endDay = getStartOfDayUTC(endDate);
	const startDay = new Date(endDay);
	startDay.setDate(startDay.getDate() - (days - 1));

	// Check if endDate is today in IST
	const todayUTC = getStartOfDayUTC(new Date());
	const isEndDateToday = endDay.getTime() === todayUTC.getTime();

	// Query analytics for historical days (exclude today if it's in range)
	const analyticsEndDay = isEndDateToday
		? new Date(endDay.getTime() - 24 * 60 * 60 * 1000)
		: endDay;

	const results = await db
		.select({
			day: analyticsDailyRevenueTable.day,
			revenue: analyticsDailyRevenueTable.grossRevenue,
			orders: analyticsDailyRevenueTable.orderCount,
		})
		.from(analyticsDailyRevenueTable)
		.where(
			and(
				gte(analyticsDailyRevenueTable.day, startDay),
				lte(analyticsDailyRevenueTable.day, analyticsEndDay),
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
					gte(ordersTable.createdAt, dayStartIST),
					lte(ordersTable.createdAt, dayEndIST),
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
	const date = dateString ? new Date(dateString) : new Date();
	const dayKey = getDayKey(date);

	return unstable_cache(
		() => getDashboardStats(date),
		["dashboard-stats", dayKey],
		{
			revalidate: 60, // Revalidate every minute
			tags: ["orders", "dashboard"],
		},
	)();
}

export async function getCachedStockPerDessert(dateString?: string) {
	const date = dateString ? new Date(dateString) : new Date();
	const day = getStartOfDayUTC(date);
	const dayKey = getDayKey(date);

	return unstable_cache(
		() => getStockPerDessert(day),
		["stock-per-dessert", dayKey],
		{
			revalidate: 60,
			tags: ["inventory", "desserts", "dashboard"],
		},
	)();
}

export async function getCachedAuditLogs(dateString?: string) {
	const date = dateString ? new Date(dateString) : new Date();
	const dayKey = getDayKey(date);

	return unstable_cache(() => getAuditLogs(date), ["audit-logs", dayKey], {
		revalidate: 60,
		tags: ["inventory", "dashboard"],
	})();
}

export async function getCachedDailyRevenue(dateString?: string) {
	const date = dateString ? new Date(dateString) : new Date();
	const dayKey = getDayKey(date);

	return unstable_cache(
		() => getDailyRevenue(date, 7),
		["daily-revenue", dayKey],
		{
			revalidate: 60 * 5, // Revalidate every 5 minutes
			tags: ["orders", "dashboard"],
		},
	)();
}
