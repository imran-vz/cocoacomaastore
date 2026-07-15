import { asc, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	dailyDessertInventoryTable,
	dessertsTable,
	inventoryAuditLogTable,
	orderItemsTable,
	ordersTable,
	userTable,
} from "@/db/schema";
import { getAnalyticsDay } from "@/lib/ist-date";
import type { CartLine } from "@/lib/types";
import { closeIntegrationDatabase, integrationDb, resetIntegrationData } from "@/test/integration/database";

const FIXED_NOW = new Date("2026-07-15T12:00:00.000Z");
const MANAGER_ID = "integration-manager";

vi.doMock("@/db", () => ({ db: integrationDb }));
vi.doMock("next/cache", () => ({
	unstable_cache: (callback: () => unknown) => callback,
	revalidatePath: vi.fn(),
	revalidateTag: vi.fn(),
	updateTag: vi.fn(),
}));

const { cancelOrderAsNormalPath, createCompletedOrder } = await import("@/lib/order-lifecycle");

async function seedInventory(quantity: number) {
	await integrationDb.insert(userTable).values({
		id: MANAGER_ID,
		name: "Integration Manager",
		email: "integration-manager@example.test",
		role: "user",
	});
	const [dessert] = await integrationDb
		.insert(dessertsTable)
		.values({ name: "Integration Dessert", price: 125, hasUnlimitedStock: false })
		.returning();
	await integrationDb.insert(dailyDessertInventoryTable).values({
		day: getAnalyticsDay(FIXED_NOW),
		dessertId: dessert.id,
		quantity,
	});
	return dessert;
}

function cartLine(dessert: { id: number; name: string; price: number }, quantity: number): CartLine {
	return {
		cartLineId: `line-${quantity}`,
		baseDessertId: dessert.id,
		baseDessertName: dessert.name,
		baseDessertPrice: dessert.price,
		hasUnlimitedStock: false,
		modifiers: [],
		unitPrice: dessert.price,
		quantity,
	};
}

describe("order lifecycle persistence", () => {
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

	it("rolls back the complete order transaction when stock is insufficient", async () => {
		const dessert = await seedInventory(1);

		await expect(
			createCompletedOrder(
				{ customerName: "Rollback", lines: [cartLine(dessert, 2)], deliveryCost: "0.00" },
				MANAGER_ID,
			),
		).rejects.toThrow();

		expect(await integrationDb.select().from(ordersTable)).toHaveLength(0);
		expect(await integrationDb.select().from(orderItemsTable)).toHaveLength(0);
		expect(await integrationDb.select().from(inventoryAuditLogTable)).toHaveLength(0);
		expect((await integrationDb.select().from(dailyDessertInventoryTable))[0]?.quantity).toBe(1);
	});

	it("serializes competing stock deductions so exactly one order succeeds", async () => {
		const dessert = await seedInventory(1);
		const data = { customerName: "Concurrent", lines: [cartLine(dessert, 1)], deliveryCost: "0.00" };

		const results = await Promise.allSettled([
			createCompletedOrder(data, MANAGER_ID),
			createCompletedOrder(data, MANAGER_ID),
		]);

		expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
		expect(results.filter(({ status }) => status === "rejected")).toHaveLength(1);
		expect(await integrationDb.select().from(ordersTable)).toHaveLength(1);
		expect(await integrationDb.select().from(inventoryAuditLogTable)).toHaveLength(1);
		expect((await integrationDb.select().from(dailyDessertInventoryTable))[0]?.quantity).toBe(0);
	});

	it("restores same-day stock and records cancellation after the deduction audit", async () => {
		const dessert = await seedInventory(2);
		await createCompletedOrder(
			{ customerName: "Cancellation", lines: [cartLine(dessert, 1)], deliveryCost: "0.00" },
			MANAGER_ID,
		);
		const [order] = await integrationDb.select({ id: ordersTable.id }).from(ordersTable);

		await cancelOrderAsNormalPath(order.id, MANAGER_ID, "integration cancellation");

		const [persistedOrder] = await integrationDb.select().from(ordersTable).where(eq(ordersTable.id, order.id));
		const [inventory] = await integrationDb.select().from(dailyDessertInventoryTable);
		const audits = await integrationDb.select().from(inventoryAuditLogTable).orderBy(asc(inventoryAuditLogTable.id));
		expect(persistedOrder.status).toBe("cancelled");
		expect(inventory.quantity).toBe(2);
		expect(
			audits.map(({ action, previousQuantity, newQuantity }) => ({ action, previousQuantity, newQuantity })),
		).toEqual([
			{ action: "order_deducted", previousQuantity: 2, newQuantity: 1 },
			{ action: "order_cancelled", previousQuantity: 1, newQuantity: 2 },
		]);
	});
});
