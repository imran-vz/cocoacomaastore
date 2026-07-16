import { asc, eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dailyDessertInventoryTable, dessertsTable, inventoryAuditLogTable, ordersTable, userTable } from "@/db/schema";
import { getAnalyticsDay } from "@/lib/ist-date";
import type { CartLine } from "@/lib/types";
import {
	closeIntegrationDatabase,
	integrationDatabaseLayer,
	integrationDb,
	resetIntegrationData,
} from "@/test/integration/database";

const FIXED_NOW = new Date("2026-07-15T12:00:00.000Z");
const MANAGER_ID = "inventory-manager";

vi.doMock("@/db", () => ({ db: integrationDb }));
vi.doMock("next/cache", () => ({
	unstable_cache: (callback: () => unknown) => callback,
	revalidatePath: vi.fn(),
	revalidateTag: vi.fn(),
	updateTag: vi.fn(),
}));

const { setInventoryWithAuditEffect } = await import("@/lib/daily-inventory");
const { createCompletedOrder } = await import("@/lib/order-lifecycle");

async function seedManager() {
	await integrationDb.insert(userTable).values({
		id: MANAGER_ID,
		name: "Inventory Manager",
		email: "inventory-manager@example.test",
		role: "user",
	});
}

async function seedDessert(name: string, quantity?: number) {
	const [dessert] = await integrationDb
		.insert(dessertsTable)
		.values({ name, price: 100, hasUnlimitedStock: false })
		.returning();
	if (quantity !== undefined) {
		await integrationDb.insert(dailyDessertInventoryTable).values({
			day: getAnalyticsDay(FIXED_NOW),
			dessertId: dessert.id,
			quantity,
		});
	}
	return dessert;
}

function runManualWrite(updates: Array<{ dessertId: number; expectedQuantity: number; quantity: number }>) {
	return Effect.runPromise(
		setInventoryWithAuditEffect({
			day: getAnalyticsDay(FIXED_NOW),
			updates,
			userId: MANAGER_ID,
			now: FIXED_NOW,
		}).pipe(Effect.provide(integrationDatabaseLayer)),
	);
}

function orderLine(dessert: { id: number; name: string; price: number }): CartLine {
	return {
		cartLineId: "inventory-race-line",
		baseDessertId: dessert.id,
		baseDessertName: dessert.name,
		baseDessertPrice: dessert.price,
		hasUnlimitedStock: false,
		modifiers: [],
		unitPrice: dessert.price,
		quantity: 1,
	};
}

describe("manual inventory persistence", () => {
	beforeEach(async () => {
		await resetIntegrationData();
		vi.useFakeTimers({ toFake: ["Date"], now: FIXED_NOW });
		await seedManager();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	afterAll(async () => {
		await closeIntegrationDatabase();
	});

	it("writes an audited absolute quantity atomically", async () => {
		const dessert = await seedDessert("Audited Dessert", 5);

		await expect(runManualWrite([{ dessertId: dessert.id, expectedQuantity: 5, quantity: 8 }])).resolves.toEqual({
			ok: true,
			updatedCount: 1,
		});

		const [inventory] = await integrationDb.select().from(dailyDessertInventoryTable);
		const [audit] = await integrationDb.select().from(inventoryAuditLogTable);
		expect(inventory.quantity).toBe(8);
		expect(audit).toMatchObject({
			action: "set_stock",
			previousQuantity: 5,
			newQuantity: 8,
			userId: MANAGER_ID,
		});
	});

	it("rolls back the entire batch and missing-row initialization on conflict", async () => {
		const existing = await seedDessert("Existing Dessert", 5);
		const missing = await seedDessert("Missing Inventory Dessert");

		await expect(
			runManualWrite([
				{ dessertId: existing.id, expectedQuantity: 4, quantity: 8 },
				{ dessertId: missing.id, expectedQuantity: 0, quantity: 9 },
			]),
		).resolves.toEqual({
			ok: false,
			code: "INVENTORY_CONFLICT",
			conflicts: [{ dessertId: existing.id, expectedQuantity: 4, actualQuantity: 5 }],
		});

		const inventory = await integrationDb.select().from(dailyDessertInventoryTable);
		expect(inventory).toHaveLength(1);
		expect(inventory[0]).toMatchObject({ dessertId: existing.id, quantity: 5 });
		expect(await integrationDb.select().from(inventoryAuditLogTable)).toHaveLength(0);
	});

	it("serializes reversed multi-row saves without partial winners or deadlocks", async () => {
		const first = await seedDessert("First Dessert", 5);
		const second = await seedDessert("Second Dessert", 7);
		const batchA = [
			{ dessertId: first.id, expectedQuantity: 5, quantity: 10 },
			{ dessertId: second.id, expectedQuantity: 7, quantity: 11 },
		];
		const batchB = [
			{ dessertId: second.id, expectedQuantity: 7, quantity: 20 },
			{ dessertId: first.id, expectedQuantity: 5, quantity: 21 },
		];

		const results = await Promise.all([runManualWrite(batchA), runManualWrite(batchB)]);

		expect(results.filter(({ ok }) => ok)).toHaveLength(1);
		expect(results.filter(({ ok }) => !ok)).toHaveLength(1);
		const rows = await integrationDb
			.select({ dessertId: dailyDessertInventoryTable.dessertId, quantity: dailyDessertInventoryTable.quantity })
			.from(dailyDessertInventoryTable)
			.orderBy(asc(dailyDessertInventoryTable.dessertId));
		expect([
			[10, 11],
			[21, 20],
		]).toContainEqual(rows.map(({ quantity }) => quantity));
		const audits = await integrationDb.select().from(inventoryAuditLogTable);
		expect(audits).toHaveLength(2);
		const finalByDessert = new Map(rows.map(({ dessertId, quantity }) => [dessertId, quantity]));
		expect(
			audits.every((audit) => audit.dessertId !== null && finalByDessert.get(audit.dessertId) === audit.newQuantity),
		).toBe(true);
	});

	it("serializes a manual save with an order deduction", async () => {
		const dessert = await seedDessert("Order Race Dessert", 5);
		const orderPromise = createCompletedOrder(
			{
				submissionId: "00000000-0000-4000-8000-000000000001",
				customerName: "Inventory Race",
				lines: [orderLine(dessert)],
				deliveryCost: "0.00",
			},
			MANAGER_ID,
		);
		const manualPromise = runManualWrite([{ dessertId: dessert.id, expectedQuantity: 5, quantity: 10 }]);

		const [, manualResult] = await Promise.all([orderPromise, manualPromise]);

		expect(await integrationDb.select().from(ordersTable)).toHaveLength(1);
		const [inventory] = await integrationDb
			.select()
			.from(dailyDessertInventoryTable)
			.where(eq(dailyDessertInventoryTable.dessertId, dessert.id));
		expect(inventory.quantity).not.toBe(10);
		const audits = await integrationDb
			.select()
			.from(inventoryAuditLogTable)
			.where(inArray(inventoryAuditLogTable.dessertId, [dessert.id]))
			.orderBy(asc(inventoryAuditLogTable.id));

		if (manualResult.ok) {
			expect(inventory.quantity).toBe(9);
			expect(
				audits.map(({ action, previousQuantity, newQuantity }) => ({ action, previousQuantity, newQuantity })),
			).toEqual([
				{ action: "set_stock", previousQuantity: 5, newQuantity: 10 },
				{ action: "order_deducted", previousQuantity: 10, newQuantity: 9 },
			]);
		} else {
			expect(manualResult).toEqual({
				ok: false,
				code: "INVENTORY_CONFLICT",
				conflicts: [{ dessertId: dessert.id, expectedQuantity: 5, actualQuantity: 4 }],
			});
			expect(inventory.quantity).toBe(4);
			expect(
				audits.map(({ action, previousQuantity, newQuantity }) => ({ action, previousQuantity, newQuantity })),
			).toEqual([{ action: "order_deducted", previousQuantity: 5, newQuantity: 4 }]);
		}
	});
});
