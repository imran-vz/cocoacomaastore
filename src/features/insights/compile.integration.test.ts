import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
	analyticsDailyDessertRevenueTable,
	analyticsDailyEodStockTable,
	analyticsDailyRevenueTable,
	analyticsMonthlyDessertRevenueTable,
	analyticsMonthlyRevenueTable,
	dessertsTable,
	inventoryAuditLogTable,
	orderItemModifiersTable,
	orderItemsTable,
	ordersTable,
} from "@/db/schema";
import { recomputeDay, recomputeMonth } from "@/features/insights/compile";
import { analyticsDate, dayEnd, dayStart } from "@/lib/shop-calendar";
import {
	closeIntegrationDatabase,
	integrationDatabaseLayer,
	integrationDb,
	resetIntegrationData,
} from "@/test/integration/database";

const DAY = "2026-07-14";
let orderSequence = 0;

function run(effect: ReturnType<typeof recomputeDay>) {
	return Effect.runPromise(effect.pipe(Effect.provide(integrationDatabaseLayer)));
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
	status?: "completed" | "cancelled";
	isDeleted?: boolean;
	total: string;
	quantity: number;
}) {
	orderSequence += 1;
	const [order] = await integrationDb
		.insert(ordersTable)
		.values({
			submissionId: `compile-order-${orderSequence}`,
			requestFingerprint: orderSequence.toString(16).padStart(64, "0"),
			customerName: "Compile",
			createdAt,
			deliveryCost: "0.00",
			total,
			status,
			isDeleted,
		})
		.returning();
	const [item] = await integrationDb
		.insert(orderItemsTable)
		.values({
			orderId: order.id,
			dessertId,
			baseDessertName: "Compile Dessert",
			inventoryDeducted: false,
			quantity,
			unitPrice: total,
		})
		.returning();
	return { order, item };
}

function dailyRows() {
	const date = analyticsDate(DAY);
	return Promise.all([
		integrationDb.select().from(analyticsDailyRevenueTable).where(eq(analyticsDailyRevenueTable.day, date)),
		integrationDb
			.select()
			.from(analyticsDailyDessertRevenueTable)
			.where(eq(analyticsDailyDessertRevenueTable.day, date)),
		integrationDb.select().from(analyticsDailyEodStockTable).where(eq(analyticsDailyEodStockTable.day, date)),
	]);
}

describe("analytics compilation", () => {
	beforeEach(async () => {
		await resetIntegrationData();
	});

	afterAll(async () => {
		await closeIntegrationDatabase();
	});

	it("overwrites a closed day's aggregates from changed source truth", async () => {
		const [dessert] = await integrationDb
			.insert(dessertsTable)
			.values({ name: "Compile Dessert", price: 100 })
			.returning();
		const start = dayStart(DAY);
		const { order: countedOrder } = await seedOrder({
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
		await seedOrder({ dessertId: dessert.id, createdAt: dayEnd(DAY), total: "450.00", quantity: 5 });
		await integrationDb.insert(inventoryAuditLogTable).values([
			{
				day: analyticsDate(DAY),
				dessertId: dessert.id,
				action: "set_stock",
				previousQuantity: 10,
				newQuantity: 8,
				createdAt: new Date(start.getTime() + 10),
			},
			{
				day: analyticsDate(DAY),
				dessertId: dessert.id,
				action: "order_deducted",
				previousQuantity: 8,
				newQuantity: 6,
				createdAt: new Date(start.getTime() + 20),
			},
		]);

		await run(recomputeDay(DAY));

		const [[daily], dessertDaily, [eod]] = await dailyRows();
		expect(daily).toMatchObject({ grossRevenue: "150.00", orderCount: 1 });
		expect(dessertDaily).toMatchObject([
			{ dessertId: dessert.id, grossRevenue: "300.00", quantitySold: 2, orderCount: 1 },
		]);
		expect(eod).toMatchObject({ dessertId: dessert.id, initialStock: 10, remainingStock: 6 });

		await integrationDb.update(ordersTable).set({ status: "cancelled" }).where(eq(ordersTable.id, countedOrder.id));
		await integrationDb.insert(inventoryAuditLogTable).values([
			{
				day: analyticsDate(DAY),
				dessertId: dessert.id,
				action: "order_cancelled",
				previousQuantity: 6,
				newQuantity: 8,
				// Written after midnight, but a change to DAY's stock.
				createdAt: new Date(dayEnd(DAY).getTime() + 30),
			},
			{
				day: analyticsDate("2026-07-15"),
				dessertId: dessert.id,
				action: "set_stock",
				previousQuantity: 0,
				newQuantity: 20,
				createdAt: new Date(start.getTime() + 40),
			},
		]);
		await run(recomputeDay(DAY));

		const [[recomputedDaily], recomputedDesserts, [recomputedEod]] = await dailyRows();
		expect(recomputedDaily).toMatchObject({ grossRevenue: "0.00", orderCount: 0 });
		expect(recomputedDesserts).toEqual([]);
		expect(recomputedEod).toMatchObject({ dessertId: dessert.id, initialStock: 10, remainingStock: 8 });
	});

	it("counts modifier quantities per dessert without revenue, and compiles a month the same way", async () => {
		const [base] = await integrationDb.insert(dessertsTable).values({ name: "Base", price: 100 }).returning();
		const [topping] = await integrationDb
			.insert(dessertsTable)
			.values({ name: "Topping", price: 20, kind: "modifier" })
			.returning();
		const { item } = await seedOrder({
			dessertId: base.id,
			createdAt: new Date(dayStart(DAY).getTime() + 1),
			total: "100.00",
			quantity: 2,
		});
		await integrationDb
			.insert(orderItemModifiersTable)
			.values({ orderItemId: item.id, dessertId: topping.id, dessertName: "Topping", quantity: 3 });

		await run(recomputeDay(DAY));
		await run(recomputeMonth("2026-07"));

		const [, dessertDaily] = await dailyRows();
		const monthlyDesserts = await integrationDb.select().from(analyticsMonthlyDessertRevenueTable);
		const [monthly] = await integrationDb.select().from(analyticsMonthlyRevenueTable);
		const expected = [
			{ dessertId: base.id, grossRevenue: "200.00", quantitySold: 2, orderCount: 1 },
			{ dessertId: topping.id, grossRevenue: "0.00", quantitySold: 6, orderCount: 1 },
		];
		const byDessert = (rows: { dessertId: number }[]) => [...rows].sort((a, b) => a.dessertId - b.dessertId);
		expect(byDessert(dessertDaily)).toMatchObject(expected);
		expect(byDessert(monthlyDesserts)).toMatchObject(expected);
		expect(monthly).toMatchObject({ month: "2026-07", grossRevenue: "100.00", orderCount: 1 });
	});
});
