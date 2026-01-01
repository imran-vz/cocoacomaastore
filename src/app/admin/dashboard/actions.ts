"use server";

import { performance } from "node:perf_hooks";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { db } from "@/db";
import {
	dailyDessertInventoryTable,
	dessertsTable,
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
	todayOrdersCount: number;
	todayRevenue: number;
	todayItemsSold: number;
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
	day: Date;
	dessertName: string;
	action: "set_stock" | "order_deducted" | "manual_adjustment";
	previousQuantity: number;
	newQuantity: number;
	orderId: number | null;
	createdAt: Date;
};

// Get dashboard stats
async function getDashboardStats(): Promise<DashboardStats> {
	const start = performance.now();

	const today = getStartOfDay();
	const weekAgo = new Date(today);
	weekAgo.setDate(weekAgo.getDate() - 7);

	// Today's stats
	const todayStats = await db
		.select({
			count: sql<number>`count(*)::int`,
			revenue: sql<number>`coalesce(sum(${ordersTable.total}), 0)::numeric`,
		})
		.from(ordersTable)
		.where(
			and(eq(ordersTable.isDeleted, false), gte(ordersTable.createdAt, today)),
		);

	// Today's items sold
	const todayItems = await db
		.select({
			totalItems: sql<number>`coalesce(sum(${orderItemsTable.quantity}), 0)::int`,
		})
		.from(orderItemsTable)
		.innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
		.where(
			and(eq(ordersTable.isDeleted, false), gte(ordersTable.createdAt, today)),
		);

	// Week stats
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
			),
		);

	const duration = performance.now() - start;
	console.log(`getDashboardStats: ${duration.toFixed(2)}ms`);

	return {
		todayOrdersCount: todayStats[0]?.count ?? 0,
		todayRevenue: Number(todayStats[0]?.revenue ?? 0),
		todayItemsSold: todayItems[0]?.totalItems ?? 0,
		weekOrdersCount: weekStats[0]?.count ?? 0,
		weekRevenue: Number(weekStats[0]?.revenue ?? 0),
	};
}

// Get stock per dessert
async function getStockPerDessert(day: Date): Promise<DessertStock[]> {
	const start = performance.now();

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
				eq(dailyDessertInventoryTable.day, day),
			),
		)
		.where(eq(dessertsTable.isDeleted, false))
		.orderBy(dessertsTable.sequence);

	const duration = performance.now() - start;
	console.log(`getStockPerDessert: ${duration.toFixed(2)}ms`);

	return desserts;
}

// Get recent audit logs
async function getRecentAuditLogs(
	day: Date,
	limit = 50,
): Promise<AuditLogEntry[]> {
	const start = performance.now();

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
		})
		.from(inventoryAuditLogTable)
		.innerJoin(
			dessertsTable,
			eq(inventoryAuditLogTable.dessertId, dessertsTable.id),
		)
		.where(gte(inventoryAuditLogTable.day, day))
		.orderBy(desc(inventoryAuditLogTable.createdAt))
		.limit(limit);

	const duration = performance.now() - start;
	console.log(`getRecentAuditLogs: ${duration.toFixed(2)}ms`);

	return logs as AuditLogEntry[];
}

// Get daily revenue for the past N days (for chart)
export type DailyRevenue = {
	date: string;
	revenue: number;
	orders: number;
};

async function getDailyRevenue(days = 7): Promise<DailyRevenue[]> {
	const start = performance.now();

	const results: DailyRevenue[] = [];
	const today = getStartOfDay();

	for (let i = days - 1; i >= 0; i--) {
		const dayStart = new Date(today);
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

// Cached exports
export async function getCachedDashboardStats() {
	const dayKey = getDayKey(getStartOfDay());

	return unstable_cache(
		() => getDashboardStats(),
		["dashboard-stats", dayKey],
		{
			revalidate: 60, // Revalidate every minute
			tags: ["orders", "dashboard"],
		},
	)();
}

export async function getCachedStockPerDessert() {
	const day = getStartOfDay();
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

export async function getCachedAuditLogs() {
	const day = getStartOfDay();
	const dayKey = getDayKey(day);

	return unstable_cache(() => getRecentAuditLogs(day), ["audit-logs", dayKey], {
		revalidate: 60,
		tags: ["inventory", "dashboard"],
	})();
}

export async function getCachedDailyRevenue() {
	const dayKey = getDayKey(getStartOfDay());

	return unstable_cache(() => getDailyRevenue(7), ["daily-revenue", dayKey], {
		revalidate: 60 * 5, // Revalidate every 5 minutes
		tags: ["orders", "dashboard"],
	})();
}
