import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	analyticsDailyDessertRevenueTable,
	analyticsDailyEodStockTable,
	analyticsDailyRevenueTable,
	dessertsTable,
	inventoryAuditLogTable,
	orderItemsTable,
	ordersTable,
} from "@/db/schema";
import { getAnalyticsDay, getEndOfDayIST, getStartOfDayIST } from "@/lib/ist-date";
import { recomputeDayAnalyticsEffect } from "@/lib/recompute-day-analytics";
import {
	closeIntegrationDatabase,
	integrationDatabaseLayer,
	integrationDb,
	resetIntegrationData,
} from "@/test/integration/database";

const FIXED_NOW = new Date("2026-07-15T12:00:00.000Z");
let orderSequence = 0;

vi.doMock("server-only", () => ({}));
vi.doMock("@/db", () => ({ db: integrationDb }));
vi.doMock("@/lib/auth/guards", () => ({ requireAdmin: vi.fn().mockResolvedValue({ id: "integration-admin" }) }));
vi.doMock("next/cache", () => ({
	unstable_cache: (callback: () => unknown) => callback,
	revalidatePath: vi.fn(),
	revalidateTag: vi.fn(),
	updateTag: vi.fn(),
}));

const { getAdminDashboardReport, getCachedEodStockTrends } = await import("@/lib/admin-reporting");

async function seedDessert() {
	const [dessert] = await integrationDb
		.insert(dessertsTable)
		.values({ name: "Reporting Dessert", price: 100 })
		.returning();
	return dessert;
}

async function seedOrder({
	dessertId,
	createdAt,
	status = "completed",
	isDeleted = false,
	total,
	quantity,
}: {
	dessertId: number;
	createdAt: Date;
	status?: "pending" | "completed" | "cancelled";
	isDeleted?: boolean;
	total: string;
	quantity: number;
}) {
	orderSequence += 1;
	const [order] = await integrationDb
		.insert(ordersTable)
		.values({
			submissionId: `reporting-order-${orderSequence}`,
			requestFingerprint: orderSequence.toString(16).padStart(64, "0"),
			customerName: "Reporting",
			createdAt,
			deliveryCost: "0.00",
			total,
			status,
			isDeleted,
		})
		.returning();
	await integrationDb.insert(orderItemsTable).values({
		orderId: order.id,
		dessertId,
		baseDessertName: "Reporting Dessert",
		inventoryDeducted: false,
		quantity,
		unitPrice: total,
	});
	return order;
}

describe("Admin reporting persistence", () => {
	beforeEach(async () => {
		await resetIntegrationData();
		vi.useFakeTimers({ toFake: ["Date"], now: FIXED_NOW });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	afterAll(async () => {
		await closeIntegrationDatabase();
	});

	it("reads current-day revenue live even when the compiled row is stale", async () => {
		const dessert = await seedDessert();
		const start = getStartOfDayIST(FIXED_NOW);
		const end = getEndOfDayIST(FIXED_NOW);
		await integrationDb.insert(analyticsDailyRevenueTable).values({
			day: getAnalyticsDay(FIXED_NOW),
			grossRevenue: "9999.00",
			orderCount: 99,
		});
		const [firstOrder] = await Promise.all([
			seedOrder({ dessertId: dessert.id, createdAt: start, total: "100.00", quantity: 1 }),
			seedOrder({ dessertId: dessert.id, createdAt: new Date(end.getTime() - 1), total: "200.00", quantity: 2 }),
			seedOrder({
				dessertId: dessert.id,
				createdAt: new Date(start.getTime() + 1),
				status: "cancelled",
				total: "300.00",
				quantity: 3,
			}),
			seedOrder({
				dessertId: dessert.id,
				createdAt: new Date(start.getTime() + 2),
				isDeleted: true,
				total: "400.00",
				quantity: 4,
			}),
			seedOrder({ dessertId: dessert.id, createdAt: new Date(start.getTime() - 1), total: "500.00", quantity: 5 }),
			seedOrder({ dessertId: dessert.id, createdAt: end, total: "600.00", quantity: 6 }),
		]);

		const report = await getAdminDashboardReport("2026-07-15");

		expect(report.stats.dayOrdersCount).toBe(2);
		expect(report.stats.dayRevenue).toBe(300);
		expect(report.stats.dayItemsSold).toBe(3);
		expect(report.dailyRevenue.at(-1)).toMatchObject({ orders: 2, revenue: 300 });

		await integrationDb.update(ordersTable).set({ status: "cancelled" }).where(eq(ordersTable.id, firstOrder.id));
		const updated = await getAdminDashboardReport("2026-07-15");
		expect(updated.stats).toMatchObject({ dayOrdersCount: 1, dayRevenue: 200, dayItemsSold: 2 });
		expect(updated.dailyRevenue.at(-1)).toMatchObject({ orders: 1, revenue: 200 });
	});

	it("returns only the requested closed-day EOD stock window", async () => {
		const dessert = await seedDessert();
		const currentDay = getAnalyticsDay(FIXED_NOW);
		const lowerBound = new Date(currentDay);
		lowerBound.setUTCDate(lowerBound.getUTCDate() - 2);
		const beforeWindow = new Date(lowerBound);
		beforeWindow.setUTCDate(beforeWindow.getUTCDate() - 1);
		const previousDay = new Date(currentDay);
		previousDay.setUTCDate(previousDay.getUTCDate() - 1);

		await integrationDb.insert(analyticsDailyEodStockTable).values([
			{ day: beforeWindow, dessertId: dessert.id, initialStock: 20, remainingStock: 19 },
			{ day: lowerBound, dessertId: dessert.id, initialStock: 19, remainingStock: 18 },
			{ day: previousDay, dessertId: dessert.id, initialStock: 18, remainingStock: 17 },
			{ day: currentDay, dessertId: dessert.id, initialStock: 17, remainingStock: 1 },
		]);

		const trends = await getCachedEodStockTrends(2);
		expect(trends.map(({ day, initialStock, remainingStock }) => ({ day, initialStock, remainingStock }))).toEqual([
			{ day: lowerBound.toISOString().slice(0, 10), initialStock: 19, remainingStock: 18 },
			{ day: previousDay.toISOString().slice(0, 10), initialStock: 18, remainingStock: 17 },
		]);
	});

	it("overwrites closed-day aggregates from changed source truth", async () => {
		const dessert = await seedDessert();
		const closedDay = new Date("2026-07-14T12:00:00.000Z");
		const start = getStartOfDayIST(closedDay);
		const end = getEndOfDayIST(closedDay);
		const countedOrder = await seedOrder({
			dessertId: dessert.id,
			createdAt: new Date(start.getTime() + 1),
			total: "150.00",
			quantity: 2,
		});
		await seedOrder({
			dessertId: dessert.id,
			createdAt: new Date(start.getTime() + 2),
			status: "cancelled",
			total: "250.00",
			quantity: 3,
		});
		await seedOrder({
			dessertId: dessert.id,
			createdAt: new Date(start.getTime() + 3),
			isDeleted: true,
			total: "350.00",
			quantity: 4,
		});
		await seedOrder({ dessertId: dessert.id, createdAt: end, total: "450.00", quantity: 5 });
		await integrationDb.insert(inventoryAuditLogTable).values([
			{
				day: getAnalyticsDay(closedDay),
				dessertId: dessert.id,
				action: "set_stock",
				previousQuantity: 10,
				newQuantity: 8,
				createdAt: new Date(start.getTime() + 10),
			},
			{
				day: getAnalyticsDay(closedDay),
				dessertId: dessert.id,
				action: "order_deducted",
				previousQuantity: 8,
				newQuantity: 6,
				createdAt: new Date(start.getTime() + 20),
			},
		]);

		await Effect.runPromise(recomputeDayAnalyticsEffect(closedDay).pipe(Effect.provide(integrationDatabaseLayer)));

		const [daily] = await integrationDb
			.select()
			.from(analyticsDailyRevenueTable)
			.where(eq(analyticsDailyRevenueTable.day, getAnalyticsDay(closedDay)));
		const [dessertDaily] = await integrationDb
			.select()
			.from(analyticsDailyDessertRevenueTable)
			.where(eq(analyticsDailyDessertRevenueTable.day, getAnalyticsDay(closedDay)));
		const [eod] = await integrationDb
			.select()
			.from(analyticsDailyEodStockTable)
			.where(eq(analyticsDailyEodStockTable.day, getAnalyticsDay(closedDay)));
		expect(daily).toMatchObject({ grossRevenue: "150.00", orderCount: 1 });
		expect(dessertDaily).toMatchObject({
			dessertId: dessert.id,
			grossRevenue: "300.00",
			quantitySold: 2,
			orderCount: 1,
		});
		expect(eod).toMatchObject({ dessertId: dessert.id, initialStock: 10, remainingStock: 6 });

		await integrationDb.update(ordersTable).set({ status: "cancelled" }).where(eq(ordersTable.id, countedOrder.id));
		await integrationDb.insert(inventoryAuditLogTable).values({
			day: getAnalyticsDay(closedDay),
			dessertId: dessert.id,
			action: "order_deducted",
			previousQuantity: 6,
			newQuantity: 4,
			createdAt: new Date(start.getTime() + 30),
		});
		await Effect.runPromise(recomputeDayAnalyticsEffect(closedDay).pipe(Effect.provide(integrationDatabaseLayer)));

		const [recomputedDaily] = await integrationDb
			.select()
			.from(analyticsDailyRevenueTable)
			.where(eq(analyticsDailyRevenueTable.day, getAnalyticsDay(closedDay)));
		const recomputedDesserts = await integrationDb
			.select()
			.from(analyticsDailyDessertRevenueTable)
			.where(eq(analyticsDailyDessertRevenueTable.day, getAnalyticsDay(closedDay)));
		const [recomputedEod] = await integrationDb
			.select()
			.from(analyticsDailyEodStockTable)
			.where(eq(analyticsDailyEodStockTable.day, getAnalyticsDay(closedDay)));
		expect(recomputedDaily).toMatchObject({ grossRevenue: "0.00", orderCount: 0 });
		expect(recomputedDesserts).toEqual([]);
		expect(recomputedEod).toMatchObject({ dessertId: dessert.id, initialStock: 10, remainingStock: 4 });
	});
});
