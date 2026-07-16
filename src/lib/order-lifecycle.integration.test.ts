import { asc, eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	dailyDessertInventoryTable,
	dessertComboItemsTable,
	dessertCombosTable,
	dessertsTable,
	inventoryAuditLogTable,
	orderItemModifiersTable,
	orderItemsTable,
	ordersTable,
	userTable,
} from "@/db/schema";
import { getAnalyticsDay } from "@/lib/ist-date";
import { buildOrderInvoiceModel } from "@/lib/order-invoice-model";
import type { OrderRequestLine } from "@/lib/types";
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

const { cancelOrderAsNormalPath, createCompletedOrder, getOrders, serializeOrders } = await import(
	"@/lib/order-lifecycle"
);

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

function cartLine(dessert: { id: number }, quantity: number): OrderRequestLine {
	return {
		baseDessertId: dessert.id,
		quantity,
	};
}

function deferred<T = void>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((complete) => {
		resolve = complete;
	});
	return { promise, resolve };
}

async function waitUntilBlockedBy(writerPid: number) {
	for (let attempt = 0; attempt < 200; attempt += 1) {
		const blocked = await integrationDb.execute(sql`
			SELECT 1
			FROM pg_stat_activity
			WHERE ${writerPid} = ANY(pg_blocking_pids(pid))
			LIMIT 1
		`);
		if (blocked.length > 0) return;
		await new Promise<void>((resolve) => setImmediate(resolve));
	}
	throw new Error("Order did not block on the catalog writer");
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

	it("persists authoritative catalog prices and immutable direct snapshots", async () => {
		const dessert = await seedInventory(3);

		await createCompletedOrder(
			{ customerName: "Authoritative", lines: [cartLine(dessert, 2)], deliveryCost: "10.50" },
			MANAGER_ID,
		);

		const [persistedOrder] = await integrationDb.select().from(ordersTable);
		const [persistedItem] = await integrationDb.select().from(orderItemsTable);
		expect(persistedOrder.total).toBe("260.50");
		expect(persistedItem).toMatchObject({
			baseDessertName: "Integration Dessert",
			inventoryDeducted: true,
			unitPrice: "125.00",
		});

		await integrationDb
			.update(dessertsTable)
			.set({ name: "Renamed Later", price: 999, enabled: false, isDeleted: true })
			.where(eq(dessertsTable.id, dessert.id));
		const [historical] = await getOrders(FIXED_NOW);
		expect(historical.orderItems[0]).toMatchObject({
			dessert: { id: dessert.id, name: "Integration Dessert" },
			unitPrice: "125",
		});
	});

	it("persists combo and modifier snapshots after catalog edits", async () => {
		const baseDessert = await seedInventory(2);
		const [modifier] = await integrationDb
			.insert(dessertsTable)
			.values({ name: "Original Modifier", price: 25, kind: "modifier", hasUnlimitedStock: true })
			.returning();
		const [combo] = await integrationDb
			.insert(dessertCombosTable)
			.values({ name: "Original Combo", baseDessertId: baseDessert.id })
			.returning();
		await integrationDb
			.insert(dessertComboItemsTable)
			.values({ comboId: combo.id, dessertId: modifier.id, quantity: 2 });

		await createCompletedOrder(
			{
				customerName: "Combo",
				lines: [{ baseDessertId: baseDessert.id, comboId: combo.id, quantity: 1 }],
				deliveryCost: "0.00",
			},
			MANAGER_ID,
		);
		await integrationDb
			.update(dessertCombosTable)
			.set({ name: "Renamed Combo", overridePrice: 1 })
			.where(eq(dessertCombosTable.id, combo.id));
		await integrationDb
			.update(dessertsTable)
			.set({ name: "Renamed Modifier", price: 1 })
			.where(eq(dessertsTable.id, modifier.id));

		const [historical] = await getOrders(FIXED_NOW);
		expect(historical.total).toBe("175.00");
		expect(historical.orderItems[0]).toMatchObject({
			comboName: "Original Combo",
			unitPrice: "175",
			modifiers: [{ dessert: { id: modifier.id, name: "Original Modifier" }, quantity: 2 }],
		});
		expect(historical.orderItems[0]).not.toHaveProperty("baseDessertName");
		expect(historical.orderItems[0]).not.toHaveProperty("inventoryDeducted");
		expect(historical.orderItems[0]?.modifiers[0]).not.toHaveProperty("dessertName");
		expect(buildOrderInvoiceModel(serializeOrders([historical])[0])).toMatchObject({
			lines: [
				{
					name: "Original Combo",
					details: "Includes: Integration Dessert, Original Modifier x2",
				},
			],
		});
		const [modifierSnapshot] = await integrationDb.select().from(orderItemModifiersTable);
		expect(modifierSnapshot.dessertName).toBe("Original Modifier");
	});

	it("restricts catalog deletion while snapshots exist and cascades snapshots with their order", async () => {
		const baseDessert = await seedInventory(2);
		const [modifier] = await integrationDb
			.insert(dessertsTable)
			.values({ name: "Restricted Modifier", price: 25, kind: "modifier", hasUnlimitedStock: true })
			.returning();
		const [combo] = await integrationDb
			.insert(dessertCombosTable)
			.values({ name: "Restricted Combo", baseDessertId: baseDessert.id })
			.returning();
		await integrationDb
			.insert(dessertComboItemsTable)
			.values({ comboId: combo.id, dessertId: modifier.id, quantity: 1 });
		await createCompletedOrder(
			{
				customerName: "Foreign keys",
				lines: [{ baseDessertId: baseDessert.id, comboId: combo.id, quantity: 1 }],
				deliveryCost: "0.00",
			},
			MANAGER_ID,
		);

		await expect(integrationDb.delete(dessertsTable).where(eq(dessertsTable.id, baseDessert.id))).rejects.toThrow();
		await expect(integrationDb.delete(dessertsTable).where(eq(dessertsTable.id, modifier.id))).rejects.toThrow();
		await integrationDb.delete(ordersTable);
		expect(await integrationDb.select().from(orderItemsTable)).toHaveLength(0);
		expect(await integrationDb.select().from(orderItemModifiersTable)).toHaveLength(0);
	});

	it("rolls back an order with an inactive catalog reference", async () => {
		const dessert = await seedInventory(2);
		await integrationDb.update(dessertsTable).set({ enabled: false }).where(eq(dessertsTable.id, dessert.id));

		await expect(
			createCompletedOrder(
				{ customerName: "Inactive", lines: [cartLine(dessert, 1)], deliveryCost: "0.00" },
				MANAGER_ID,
			),
		).rejects.toThrow();
		expect(await integrationDb.select().from(ordersTable)).toHaveLength(0);
		expect((await integrationDb.select().from(dailyDessertInventoryTable))[0]?.quantity).toBe(2);
	});

	it("rolls back the complete transaction when the aggregate total exceeds persistence capacity", async () => {
		const dessert = await seedInventory(3);
		await integrationDb.update(dessertsTable).set({ price: 99_999_999 }).where(eq(dessertsTable.id, dessert.id));

		await expect(
			createCompletedOrder(
				{ customerName: "Overflow", lines: [cartLine(dessert, 2)], deliveryCost: "0.00" },
				MANAGER_ID,
			),
		).rejects.toThrow();
		expect(await integrationDb.select().from(ordersTable)).toHaveLength(0);
		expect(await integrationDb.select().from(orderItemsTable)).toHaveLength(0);
		expect(await integrationDb.select().from(inventoryAuditLogTable)).toHaveLength(0);
		expect((await integrationDb.select().from(dailyDessertInventoryTable))[0]?.quantity).toBe(3);
	});

	it("waits for a catalog update and snapshots the committed values", async () => {
		const dessert = await seedInventory(2);
		const catalogUpdated = deferred<number>();
		const releaseCatalogUpdate = deferred();
		const update = integrationDb.transaction(async (tx) => {
			const [backend] = (await tx.execute(sql`
				SELECT pg_backend_pid()::integer AS pid
			`)) as unknown as [{ pid: number }];
			await tx
				.select({ id: dessertsTable.id })
				.from(dessertsTable)
				.where(eq(dessertsTable.id, dessert.id))
				.for("update");
			await tx
				.update(dessertsTable)
				.set({ name: "Committed Name", price: 175 })
				.where(eq(dessertsTable.id, dessert.id));
			catalogUpdated.resolve(backend.pid);
			await releaseCatalogUpdate.promise;
		});
		const writerPid = await catalogUpdated.promise;

		const order = createCompletedOrder(
			{ customerName: "Race", lines: [cartLine(dessert, 1)], deliveryCost: "0.00" },
			MANAGER_ID,
		);
		try {
			await waitUntilBlockedBy(writerPid);
		} finally {
			releaseCatalogUpdate.resolve();
		}
		await Promise.all([update, order]);

		expect((await integrationDb.select().from(ordersTable))[0]?.total).toBe("175.00");
		expect((await integrationDb.select().from(orderItemsTable))[0]).toMatchObject({
			baseDessertName: "Committed Name",
			unitPrice: "175.00",
		});
	});

	it("waits for a combo-item replacement and snapshots the coherent committed set", async () => {
		const baseDessert = await seedInventory(2);
		const [oldModifier, newModifier] = await integrationDb
			.insert(dessertsTable)
			.values([
				{ name: "Old Modifier", price: 25, kind: "modifier", hasUnlimitedStock: true },
				{ name: "New Modifier", price: 40, kind: "modifier", hasUnlimitedStock: true },
			])
			.returning();
		const [combo] = await integrationDb
			.insert(dessertCombosTable)
			.values({ name: "Concurrent Combo", baseDessertId: baseDessert.id })
			.returning();
		await integrationDb
			.insert(dessertComboItemsTable)
			.values({ comboId: combo.id, dessertId: oldModifier.id, quantity: 1 });

		const comboItemsReplaced = deferred<number>();
		const releaseComboUpdate = deferred();
		const update = integrationDb.transaction(async (tx) => {
			const [backend] = (await tx.execute(sql`
				SELECT pg_backend_pid()::integer AS pid
			`)) as unknown as [{ pid: number }];
			await tx
				.select({ id: dessertCombosTable.id })
				.from(dessertCombosTable)
				.where(eq(dessertCombosTable.id, combo.id))
				.for("no key update");
			await tx.delete(dessertComboItemsTable).where(eq(dessertComboItemsTable.comboId, combo.id));
			await tx.insert(dessertComboItemsTable).values({ comboId: combo.id, dessertId: newModifier.id, quantity: 2 });
			comboItemsReplaced.resolve(backend.pid);
			await releaseComboUpdate.promise;
		});
		const writerPid = await comboItemsReplaced.promise;

		const order = createCompletedOrder(
			{
				customerName: "Combo Race",
				lines: [{ baseDessertId: baseDessert.id, comboId: combo.id, quantity: 1 }],
				deliveryCost: "0.00",
			},
			MANAGER_ID,
		);
		try {
			await waitUntilBlockedBy(writerPid);
		} finally {
			releaseComboUpdate.resolve();
		}
		await Promise.all([update, order]);

		expect((await integrationDb.select().from(ordersTable))[0]?.total).toBe("205.00");
		expect(await integrationDb.select().from(orderItemModifiersTable)).toMatchObject([
			{ dessertId: newModifier.id, dessertName: "New Modifier", quantity: 2 },
		]);
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
		expect((await integrationDb.select().from(orderItemsTable))[0]?.inventoryDeducted).toBe(true);
		await integrationDb.update(dessertsTable).set({ hasUnlimitedStock: true }).where(eq(dessertsTable.id, dessert.id));

		await cancelOrderAsNormalPath(order.id, MANAGER_ID, "integration cancellation");
		await expect(cancelOrderAsNormalPath(order.id, MANAGER_ID)).rejects.toThrow();

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

	it("cancels an unlimited-stock-only order without deduction audits", async () => {
		const dessert = await seedInventory(2);
		await integrationDb.update(dessertsTable).set({ hasUnlimitedStock: true }).where(eq(dessertsTable.id, dessert.id));
		await createCompletedOrder(
			{ customerName: "Unlimited", lines: [cartLine(dessert, 1)], deliveryCost: "0.00" },
			MANAGER_ID,
		);
		const [order] = await integrationDb.select({ id: ordersTable.id }).from(ordersTable);
		expect((await integrationDb.select().from(orderItemsTable))[0]?.inventoryDeducted).toBe(false);

		await cancelOrderAsNormalPath(order.id, MANAGER_ID);

		expect((await integrationDb.select().from(ordersTable))[0]?.status).toBe("cancelled");
		expect(await integrationDb.select().from(inventoryAuditLogTable)).toHaveLength(0);
		expect((await integrationDb.select().from(dailyDessertInventoryTable))[0]?.quantity).toBe(2);
	});

	it("rolls back cancellation when a finite-stock deduction audit is missing", async () => {
		const dessert = await seedInventory(2);
		await createCompletedOrder(
			{ customerName: "Missing audit", lines: [cartLine(dessert, 1)], deliveryCost: "0.00" },
			MANAGER_ID,
		);
		const [order] = await integrationDb.select({ id: ordersTable.id }).from(ordersTable);
		await integrationDb.delete(inventoryAuditLogTable).where(eq(inventoryAuditLogTable.orderId, order.id));

		await expect(cancelOrderAsNormalPath(order.id, MANAGER_ID)).rejects.toThrow();
		expect((await integrationDb.select().from(ordersTable))[0]?.status).toBe("completed");
		expect((await integrationDb.select().from(dailyDessertInventoryTable))[0]?.quantity).toBe(1);
	});

	it("rolls back cancellation when deduction audit evidence is malformed", async () => {
		const dessert = await seedInventory(2);
		await createCompletedOrder(
			{ customerName: "Malformed", lines: [cartLine(dessert, 1)], deliveryCost: "0.00" },
			MANAGER_ID,
		);
		const [order] = await integrationDb.select({ id: ordersTable.id }).from(ordersTable);
		await integrationDb
			.update(inventoryAuditLogTable)
			.set({ previousQuantity: 1, newQuantity: 1 })
			.where(eq(inventoryAuditLogTable.orderId, order.id));

		await expect(cancelOrderAsNormalPath(order.id, MANAGER_ID)).rejects.toThrow();
		expect((await integrationDb.select().from(ordersTable))[0]?.status).toBe("completed");
		expect((await integrationDb.select().from(dailyDessertInventoryTable))[0]?.quantity).toBe(1);
	});
});
