"use server";

import { performance } from "node:perf_hooks";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { db } from "@/db";
import {
	dailyDessertInventoryTable,
	dessertsTable,
	type InventoryAuditLog,
	inventoryAuditLogTable,
	orderItemsTable,
	ordersTable,
} from "@/db/schema";

function getStartOfDay(date: Date = new Date()) {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

function getEndOfDay(date: Date = new Date()) {
	const d = new Date(date);
	d.setHours(23, 59, 59, 999);
	return d;
}

function getDayKey(day: Date) {
	const y = day.getFullYear();
	const m = String(day.getMonth() + 1).padStart(2, "0");
	const d = String(day.getDate()).padStart(2, "0");
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

export type AuditLogEntry = Pick<
	InventoryAuditLog,
	| "id"
	| "day"
	| "action"
	| "previousQuantity"
	| "newQuantity"
	| "orderId"
	| "createdAt"
	| "note"
> & {
	dessertName: string;
};

// Get dashboard stats for a specific day
async function getDashboardStats(date: Date): Promise<DashboardStats> {
	const start = performance.now();

	const dayStart = getStartOfDay(date);
	const dayEnd = getEndOfDay(date);
	const weekAgo = new Date(dayStart);
	weekAgo.setDate(weekAgo.getDate() - 7);

	// Day's stats
	const dayStats = await db
		.select({
			count: sql<number>`count(*)::int`,
			revenue: sql<number>`coalesce(sum(${ordersTable.total}), 0)::numeric`,
		})
		.from(ordersTable)
		.where(
			and(
				eq(ordersTable.isDeleted, false),
				gte(ordersTable.createdAt, dayStart),
				lt(ordersTable.createdAt, dayEnd),
			),
		);

	// Day's items sold
	const dayItems = await db
		.select({
			totalItems: sql<number>`coalesce(sum(${orderItemsTable.quantity}), 0)::int`,
		})
		.from(orderItemsTable)
		.innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
		.where(
			and(
				eq(ordersTable.isDeleted, false),
				gte(ordersTable.createdAt, dayStart),
				lt(ordersTable.createdAt, dayEnd),
			),
		);

	// Week stats (7 days before the selected date)
	const weekStats = await db
		.select({
			count: sql<number>`count(*)::int`,
			revenue: sql<number>`coalesce(sum(${ordersTable.total}), 0)::numeric`,
		})
		.from(ordersTable)
		.where(
			and(
				eq(ordersTable.isDeleted, false),
				gte(ordersTable.createdAt, weekAgo),
				lt(ordersTable.createdAt, dayEnd),
			),
		);

	const duration = performance.now() - start;
	console.log(`getDashboardStats: ${duration.toFixed(2)}ms`);

	return {
		dayOrdersCount: dayStats[0]?.count ?? 0,
		dayRevenue: Number(dayStats[0]?.revenue ?? 0),
		dayItemsSold: dayItems[0]?.totalItems ?? 0,
		weekOrdersCount: weekStats[0]?.count ?? 0,
		weekRevenue: Number(weekStats[0]?.revenue ?? 0),
	};
}

// Get stock per dessert for a specific day
async function getStockPerDessert(day: Date): Promise<DessertStock[]> {
	const start = performance.now();

	const dayStart = getStartOfDay(day);

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

	const dayStart = getStartOfDay(date);
	const dayEnd = getEndOfDay(date);

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

	return logs;
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

	const results: DailyRevenue[] = [];
	const endDay = getStartOfDay(endDate);

	for (let i = days - 1; i >= 0; i--) {
		const dayStart = new Date(endDay);
		dayStart.setDate(dayStart.getDate() - i);
		const dayEnd = getEndOfDay(dayStart);

		const stats = await db
			.select({
				count: sql<number>`count(*)::int`,
				revenue: sql<number>`coalesce(sum(${ordersTable.total}), 0)::numeric`,
			})
			.from(ordersTable)
			.where(
				and(
					eq(ordersTable.isDeleted, false),
					gte(ordersTable.createdAt, dayStart),
					lt(ordersTable.createdAt, dayEnd),
				),
			);

		results.push({
			date: dayStart.toLocaleDateString("en-IN", {
				day: "numeric",
				month: "short",
				timeZone: "Asia/Kolkata",
			}),
			revenue: Number(stats[0]?.revenue ?? 0),
			orders: stats[0]?.count ?? 0,
		});
	}

	const duration = performance.now() - start;
	console.log(`getDailyRevenue: ${duration.toFixed(2)}ms`);

	return results;
}

// Cached exports with date parameter
export async function getCachedDashboardStats(dateString?: string) {
	const date = dateString ? new Date(dateString) : new Date();
	const dayKey = getDayKey(getStartOfDay(date));

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
	const day = getStartOfDay(date);
	const dayKey = getDayKey(day);

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
	const day = getStartOfDay(date);
	const dayKey = getDayKey(day);

	return unstable_cache(() => getAuditLogs(day), ["audit-logs", dayKey], {
		revalidate: 60,
		tags: ["inventory", "dashboard"],
	})();
}

export async function getCachedDailyRevenue(dateString?: string) {
	const date = dateString ? new Date(dateString) : new Date();
	const dayKey = getDayKey(getStartOfDay(date));

	return unstable_cache(
		() => getDailyRevenue(date, 7),
		["daily-revenue", dayKey],
		{
			revalidate: 60 * 5, // Revalidate every 5 minutes
			tags: ["orders", "dashboard"],
		},
	)();
}
