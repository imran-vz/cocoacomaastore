import { asc, eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dailyDessertInventoryTable, dessertsTable, inventoryAuditLogTable, ordersTable, userTable } from "@/db/schema";
import { stockChangeTags } from "@/features/inventory/tags";
import { analyticsDate, dayKeyOf } from "@/lib/shop-calendar";
import { closeIntegrationDatabase, integrationDb, resetIntegrationData } from "@/test/integration/database";
import { createTaggedCache } from "@/test/integration/tagged-cache";
import { mockStaffSessions, signedInAs } from "@/test/staff-session";

const FIXED_NOW = new Date("2026-07-15T12:00:00.000Z");
const MANAGER_ID = "inventory-manager";

const DAY_KEY = dayKeyOf(FIXED_NOW);

const cache = createTaggedCache();
vi.doMock("server-only", () => ({}));
vi.doMock("@/db", () => ({ db: integrationDb }));
vi.doMock("next/cache", () => cache.nextCache);
mockStaffSessions();

const manager = { id: MANAGER_ID, area: "manager" } as const;
const inventory = await import("@/features/inventory/daily-inventory");
const { setStockWithAudit } = inventory;
const getTodayInventory = signedInAs(manager, inventory.getTodayInventory);
const saveTodayStock = signedInAs(manager, (await import("@/features/inventory/actions")).saveTodayStock);
const { createCompletedOrder } = await import("@/features/orders/lifecycle");

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
			day: analyticsDate(DAY_KEY),
			dessertId: dessert.id,
			quantity,
		});
	}
	return dessert;
}

function runManualWrite(updates: Array<{ dessertId: number; expectedQuantity: number; quantity: number }>) {
	return setStockWithAudit(integrationDb, { dayKey: DAY_KEY, updates, userId: MANAGER_ID });
}

function orderLine(dessert: { id: number }) {
	return { baseDessertId: dessert.id, quantity: 1 };
}

describe("manual inventory persistence", () => {
	beforeEach(async () => {
		cache.clear();
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

	it("saves today's counts for staff and refreshes today's stock", async () => {
		const dessert = await seedDessert("Counted Dessert", 2);
		await expect(getTodayInventory()).resolves.toEqual({
			dayKey: DAY_KEY,
			rows: [{ dessertId: dessert.id, quantity: 2 }],
		});

		await expect(saveTodayStock([{ dessertId: dessert.id, expectedQuantity: 2, quantity: 6 }])).resolves.toEqual({
			ok: true,
			data: { status: "saved" },
			refreshed: stockChangeTags(DAY_KEY),
		});
		await expect(getTodayInventory()).resolves.toEqual({
			dayKey: DAY_KEY,
			rows: [{ dessertId: dessert.id, quantity: 6 }],
		});
		await expect(saveTodayStock([{ dessertId: dessert.id, expectedQuantity: 6, quantity: 1.5 }])).resolves.toEqual({
			ok: false,
			error: "Stock must be a whole number",
		});
	});

	it("writes an audited absolute quantity atomically", async () => {
		const dessert = await seedDessert("Audited Dessert", 5);

		await expect(runManualWrite([{ dessertId: dessert.id, expectedQuantity: 5, quantity: 8 }])).resolves.toEqual({
			status: "saved",
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

	it("sets distinct quantities in one batch without auditing unchanged rows", async () => {
		const first = await seedDessert("Set To Zero", 5);
		const second = await seedDessert("New Stock");
		const unchanged = await seedDessert("Unchanged Stock", 7);
		await expect(
			runManualWrite([
				{ dessertId: first.id, expectedQuantity: 5, quantity: 0 },
				{ dessertId: second.id, expectedQuantity: 0, quantity: 12 },
				{ dessertId: unchanged.id, expectedQuantity: 7, quantity: 7 },
			]),
		).resolves.toEqual({ status: "saved" });
		const rows = await integrationDb
			.select()
			.from(dailyDessertInventoryTable)
			.orderBy(asc(dailyDessertInventoryTable.dessertId));
		expect(rows.map(({ quantity }) => quantity)).toEqual([0, 12, 7]);
		const audits = await integrationDb
			.select()
			.from(inventoryAuditLogTable)
			.orderBy(asc(inventoryAuditLogTable.dessertId));
		expect(
			audits.map(({ dessertId, previousQuantity, newQuantity }) => ({ dessertId, previousQuantity, newQuantity })),
		).toEqual([
			{ dessertId: first.id, previousQuantity: 5, newQuantity: 0 },
			{ dessertId: second.id, previousQuantity: 0, newQuantity: 12 },
		]);
	});

	it("rolls back the entire batch and missing-row initialization on conflict", async () => {
		const existing = await seedDessert("Existing Dessert", 5);
		const missing = await seedDessert("Missing Inventory Dessert");

		await expect(
			runManualWrite([
				{ dessertId: existing.id, expectedQuantity: 4, quantity: 8 },
				{ dessertId: missing.id, expectedQuantity: 0, quantity: 9 },
			]),
		).resolves.toEqual({ status: "conflict", conflictedIds: [existing.id] });

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

		expect(results.filter(({ status }) => status === "saved")).toHaveLength(1);
		expect(results.filter(({ status }) => status === "conflict")).toHaveLength(1);
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
		const audits = await integrationDb
			.select()
			.from(inventoryAuditLogTable)
			.where(inArray(inventoryAuditLogTable.dessertId, [dessert.id]))
			.orderBy(asc(inventoryAuditLogTable.id));

		if (manualResult.status === "saved") {
			expect(inventory.quantity).toBe(9);
			expect(
				audits.map(({ action, previousQuantity, newQuantity }) => ({ action, previousQuantity, newQuantity })),
			).toEqual([
				{ action: "set_stock", previousQuantity: 5, newQuantity: 10 },
				{ action: "order_deducted", previousQuantity: 10, newQuantity: 9 },
			]);
		} else {
			expect(manualResult).toEqual({ status: "conflict", conflictedIds: [dessert.id] });
			expect(inventory.quantity).toBe(4);
			expect(
				audits.map(({ action, previousQuantity, newQuantity }) => ({ action, previousQuantity, newQuantity })),
			).toEqual([{ action: "order_deducted", previousQuantity: 5, newQuantity: 4 }]);
		}
	});
});
