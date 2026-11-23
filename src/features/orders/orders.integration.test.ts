import { asc, eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	analyticsDailyDessertRevenueTable,
	analyticsDailyEodStockTable,
	analyticsDailyRevenueTable,
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
import {
	type CreateOrderInput,
	cancellationNote,
	MAX_ORDER_CANCELLATION_REASON_LENGTH,
	type OrderRequestLine,
} from "@/features/orders/contract";
import { analyticsDate } from "@/lib/shop-calendar";
import { closeIntegrationDatabase, integrationDb, resetIntegrationData } from "@/test/integration/database";
import { mockStaffSessions, signedInAs } from "@/test/staff-session";

const FIXED_NOW = new Date("2026-07-15T12:00:00.000Z");
const DAY = "2026-07-15";
const MANAGER_ID = "integration-manager";

vi.doMock("server-only", () => ({}));
vi.doMock("@/db", () => ({ db: integrationDb }));
mockStaffSessions();
vi.doMock("next/cache", () => ({
	unstable_cache: (callback: () => unknown) => callback,
	revalidatePath: vi.fn(),
	revalidateTag: vi.fn(),
	updateTag: vi.fn(),
}));

const manager = { id: MANAGER_ID, area: "manager" } as const;
const actions = await import("@/features/orders/actions");
const createOrder = signedInAs(manager, actions.createOrder);
const cancelOrder = signedInAs(manager, actions.cancelOrder);
const getDayOrders = signedInAs(manager, (await import("@/features/orders/queries")).getDayOrders);
const { dayOrdersTags } = await import("@/features/orders/tags");
const { dayInventoryTags } = await import("@/features/inventory/tags");

let submissionSequence = 0;

function nextSubmissionId() {
	submissionSequence += 1;
	return `00000000-0000-4000-8000-${submissionSequence.toString().padStart(12, "0")}`;
}

function placeOrder(data: Omit<CreateOrderInput, "submissionId">) {
	return createOrder({ ...data, submissionId: nextSubmissionId() });
}

function saved(result: Awaited<ReturnType<typeof createOrder>>) {
	if (!result.ok) throw new Error(`Expected the order to save: ${result.error}`);
	return result.data;
}

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
	await integrationDb
		.insert(dailyDessertInventoryTable)
		.values({ day: analyticsDate(DAY), dessertId: dessert.id, quantity });
	return dessert;
}

async function seedCombo(baseDessertId: number, name: string, addOns: { price: number; quantity: number }[]) {
	const modifiers = await integrationDb
		.insert(dessertsTable)
		.values(
			addOns.map((addOn, index) => ({
				name: `${name} Add-on ${index + 1}`,
				price: addOn.price,
				kind: "modifier" as const,
				hasUnlimitedStock: true,
			})),
		)
		.returning();
	const [combo] = await integrationDb.insert(dessertCombosTable).values({ name, baseDessertId }).returning();
	await integrationDb.insert(dessertComboItemsTable).values(
		modifiers.map((modifier, index) => ({
			comboId: combo.id,
			dessertId: modifier.id,
			quantity: addOns[index].quantity,
		})),
	);
	return { combo, modifiers };
}

function line(dessert: { id: number }, quantity: number, comboId?: number): OrderRequestLine {
	return comboId === undefined
		? { baseDessertId: dessert.id, quantity }
		: { baseDessertId: dessert.id, comboId, quantity };
}

async function onlyOrderId() {
	const [order] = await integrationDb.select({ id: ordersTable.id }).from(ordersTable);
	return order.id;
}

async function expectNothingSaved(stock: number) {
	expect(await integrationDb.select().from(ordersTable)).toHaveLength(0);
	expect(await integrationDb.select().from(orderItemsTable)).toHaveLength(0);
	expect(await integrationDb.select().from(orderItemModifiersTable)).toHaveLength(0);
	expect(await integrationDb.select().from(inventoryAuditLogTable)).toHaveLength(0);
	expect((await integrationDb.select().from(dailyDessertInventoryTable))[0]?.quantity).toBe(stock);
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

async function waitForBlockedSessionCount(expectedCount: number) {
	for (let attempt = 0; attempt < 200; attempt += 1) {
		const blocked = await integrationDb.execute(sql`
			SELECT 1
			FROM pg_stat_activity
			WHERE datname = current_database()
				AND cardinality(pg_blocking_pids(pid)) > 0
		`);
		if (blocked.length >= expectedCount) return;
		await new Promise<void>((resolve) => setImmediate(resolve));
	}
	throw new Error(`Expected ${expectedCount} blocked database sessions`);
}

/** Holds a lock on a catalog row inside `hold` until the returned release is called. */
async function lockCatalog(
	hold: (tx: Parameters<Parameters<typeof integrationDb.transaction>[0]>[0]) => Promise<void>,
) {
	const locked = deferred<number>();
	const release = deferred();
	const writer = integrationDb.transaction(async (tx) => {
		const [backend] = (await tx.execute(sql`SELECT pg_backend_pid()::integer AS pid`)) as unknown as [{ pid: number }];
		await hold(tx);
		locked.resolve(backend.pid);
		await release.promise;
	});
	return { writerPid: await locked.promise, release: release.resolve, writer };
}

describe("orders", () => {
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

	describe("creating", () => {
		it("rolls back the whole order when stock is short and says what is short", async () => {
			const dessert = await seedInventory(1);

			await expect(
				placeOrder({ customerName: "Rollback", lines: [line(dessert, 2)], deliveryCost: "0.00" }),
			).resolves.toEqual({
				ok: false,
				error: "Insufficient stock for Integration Dessert. Available: 1, Requested: 2",
			});
			await expectNothingSaved(1);
		});

		it("prices from the catalog and keeps the order's snapshot after catalog edits", async () => {
			const dessert = await seedInventory(3);

			const ack = saved(
				await placeOrder({ customerName: "Authoritative", lines: [line(dessert, 2)], deliveryCost: "10.5" }),
			);

			expect(ack).toEqual({ orderId: expect.any(Number), day: DAY, replayed: false });
			expect(await integrationDb.select().from(orderItemsTable)).toMatchObject([
				{ baseDessertName: "Integration Dessert", inventoryDeducted: true, unitPrice: "125.00" },
			]);

			await integrationDb
				.update(dessertsTable)
				.set({ name: "Renamed Later", price: 999, enabled: false, isDeleted: true })
				.where(eq(dessertsTable.id, dessert.id));
			const { orders } = await getDayOrders(DAY);
			expect(orders).toEqual([
				{
					id: ack.orderId,
					customerName: "Authoritative",
					createdAt: FIXED_NOW.toISOString(),
					status: "completed",
					deliveryCost: "10.50",
					total: "260.50",
					lines: [
						{
							id: expect.any(Number),
							quantity: 2,
							unitPrice: "125",
							dessertName: "Integration Dessert",
							comboName: null,
							modifiers: [],
						},
					],
				},
			]);
		});

		it("adds combo add-ons to the base price and snapshots names and prices", async () => {
			const base = await seedInventory(2);
			const { combo, modifiers } = await seedCombo(base.id, "Original Combo", [{ price: 25, quantity: 2 }]);

			saved(await placeOrder({ customerName: "Combo", lines: [line(base, 1, combo.id)], deliveryCost: "0.00" }));
			await integrationDb
				.update(dessertCombosTable)
				.set({ name: "Renamed Combo", overridePrice: 1 })
				.where(eq(dessertCombosTable.id, combo.id));
			await integrationDb
				.update(dessertsTable)
				.set({ name: "Renamed", price: 1 })
				.where(eq(dessertsTable.id, modifiers[0].id));

			const [order] = (await getDayOrders(DAY)).orders;
			expect(order.total).toBe("175.00");
			expect(order.lines[0]).toMatchObject({
				comboName: "Original Combo",
				dessertName: "Integration Dessert",
				modifiers: [{ name: "Original Combo Add-on 1", quantity: 2 }],
				unitPrice: "175",
			});
		});

		it("charges a combo's override price", async () => {
			const base = await seedInventory(2);
			const { combo } = await seedCombo(base.id, "Deal", [{ price: 25, quantity: 1 }]);
			await integrationDb
				.update(dessertCombosTable)
				.set({ overridePrice: 99 })
				.where(eq(dessertCombosTable.id, combo.id));

			saved(await placeOrder({ customerName: "Deal", lines: [line(base, 2, combo.id)], deliveryCost: "0.00" }));

			expect((await integrationDb.select().from(ordersTable))[0]?.total).toBe("198.00");
		});

		it("keeps catalog rows referenced by orders and deletes snapshots with their order", async () => {
			const base = await seedInventory(2);
			const { combo, modifiers } = await seedCombo(base.id, "Restricted Combo", [{ price: 25, quantity: 1 }]);
			saved(await placeOrder({ customerName: "Foreign keys", lines: [line(base, 1, combo.id)], deliveryCost: "0.00" }));

			await expect(integrationDb.delete(dessertsTable).where(eq(dessertsTable.id, base.id))).rejects.toThrow();
			await expect(integrationDb.delete(dessertsTable).where(eq(dessertsTable.id, modifiers[0].id))).rejects.toThrow();
			await integrationDb.delete(ordersTable);
			expect(await integrationDb.select().from(orderItemsTable)).toHaveLength(0);
			expect(await integrationDb.select().from(orderItemModifiersTable)).toHaveLength(0);
		});

		it("refuses stale carts whose dessert, combo base or add-on went off sale", async () => {
			const base = await seedInventory(3);
			const { combo, modifiers } = await seedCombo(base.id, "Stock Toggle Combo", [{ price: 25, quantity: 1 }]);

			await integrationDb.update(dessertsTable).set({ enabled: false }).where(eq(dessertsTable.id, base.id));
			await expect(
				placeOrder({ customerName: "Hidden", lines: [line(base, 1)], deliveryCost: "0.00" }),
			).resolves.toEqual({
				ok: false,
				error: "Integration Dessert is not on sale right now",
			});

			await integrationDb
				.update(dessertsTable)
				.set({ enabled: true, isOutOfStock: true })
				.where(eq(dessertsTable.id, base.id));
			await expect(
				placeOrder({ customerName: "Stale", lines: [line(base, 1)], deliveryCost: "0.00" }),
			).resolves.toEqual({
				ok: false,
				error: "Integration Dessert is not on sale right now",
			});
			await expect(
				placeOrder({ customerName: "Stale combo base", lines: [line(base, 1, combo.id)], deliveryCost: "0.00" }),
			).resolves.toEqual({ ok: false, error: "Stock Toggle Combo is not on sale right now" });

			await integrationDb.update(dessertsTable).set({ isOutOfStock: false }).where(eq(dessertsTable.id, base.id));
			await integrationDb
				.update(dessertsTable)
				.set({ isOutOfStock: true })
				.where(eq(dessertsTable.id, modifiers[0].id));
			await expect(
				placeOrder({ customerName: "Stale add-on", lines: [line(base, 1, combo.id)], deliveryCost: "0.00" }),
			).resolves.toEqual({ ok: false, error: "Stock Toggle Combo is not on sale right now" });

			await expectNothingSaved(3);
		});

		it("refuses duplicate lines and amounts the database cannot hold", async () => {
			const dessert = await seedInventory(3);

			await expect(
				placeOrder({ customerName: "Twice", lines: [line(dessert, 1), line(dessert, 1)], deliveryCost: "0.00" }),
			).resolves.toEqual({ ok: false, error: "The order lists the same item twice" });

			await integrationDb.update(dessertsTable).set({ price: 99_999_999 }).where(eq(dessertsTable.id, dessert.id));
			await expect(
				placeOrder({ customerName: "Overflow", lines: [line(dessert, 2)], deliveryCost: "0.00" }),
			).resolves.toEqual({
				ok: false,
				error: "The order total is more than an order can hold",
			});

			await integrationDb.update(dessertsTable).set({ price: 100_000_000 }).where(eq(dessertsTable.id, dessert.id));
			await expect(
				placeOrder({ customerName: "Price", lines: [line(dessert, 1)], deliveryCost: "0.00" }),
			).resolves.toEqual({
				ok: false,
				error: "An item's price is more than an order can hold",
			});

			await expectNothingSaved(3);
		});

		it("waits for a catalog update and snapshots the committed values", async () => {
			const dessert = await seedInventory(2);
			const { writerPid, release, writer } = await lockCatalog(async (tx) => {
				await tx
					.select({ id: dessertsTable.id })
					.from(dessertsTable)
					.where(eq(dessertsTable.id, dessert.id))
					.for("update");
				await tx
					.update(dessertsTable)
					.set({ name: "Committed Name", price: 175 })
					.where(eq(dessertsTable.id, dessert.id));
			});

			const order = placeOrder({ customerName: "Race", lines: [line(dessert, 1)], deliveryCost: "0.00" });
			try {
				await waitUntilBlockedBy(writerPid);
			} finally {
				release();
			}
			const [, result] = await Promise.all([writer, order]);

			saved(result);
			expect((await integrationDb.select().from(ordersTable))[0]?.total).toBe("175.00");
			expect((await integrationDb.select().from(orderItemsTable))[0]).toMatchObject({
				baseDessertName: "Committed Name",
				unitPrice: "175.00",
			});
		});

		it("waits for a combo-item replacement and snapshots the coherent committed set", async () => {
			const base = await seedInventory(2);
			const { combo } = await seedCombo(base.id, "Concurrent Combo", [{ price: 25, quantity: 1 }]);
			const [newModifier] = await integrationDb
				.insert(dessertsTable)
				.values({ name: "New Modifier", price: 40, kind: "modifier", hasUnlimitedStock: true })
				.returning();
			const { writerPid, release, writer } = await lockCatalog(async (tx) => {
				await tx
					.select({ id: dessertCombosTable.id })
					.from(dessertCombosTable)
					.where(eq(dessertCombosTable.id, combo.id))
					.for("no key update");
				await tx.delete(dessertComboItemsTable).where(eq(dessertComboItemsTable.comboId, combo.id));
				await tx.insert(dessertComboItemsTable).values({ comboId: combo.id, dessertId: newModifier.id, quantity: 2 });
			});

			const order = placeOrder({ customerName: "Combo Race", lines: [line(base, 1, combo.id)], deliveryCost: "0.00" });
			try {
				await waitUntilBlockedBy(writerPid);
			} finally {
				release();
			}
			const [, result] = await Promise.all([writer, order]);

			saved(result);
			expect((await integrationDb.select().from(ordersTable))[0]?.total).toBe("205.00");
			expect(await integrationDb.select().from(orderItemModifiersTable)).toMatchObject([
				{ dessertId: newModifier.id, dessertName: "New Modifier", quantity: 2 },
			]);
		});

		it("lets exactly one of two orders competing for the last item through", async () => {
			const dessert = await seedInventory(1);
			const data = { customerName: "Concurrent", lines: [line(dessert, 1)], deliveryCost: "0.00" };

			const results = await Promise.all([placeOrder(data), placeOrder(data)]);

			expect(results.filter((result) => result.ok)).toHaveLength(1);
			expect(results.filter((result) => !result.ok)).toEqual([
				{ ok: false, error: "Insufficient stock for Integration Dessert. Available: 0, Requested: 1" },
			]);
			expect(await integrationDb.select().from(ordersTable)).toHaveLength(1);
			expect(await integrationDb.select().from(inventoryAuditLogTable)).toHaveLength(1);
			expect((await integrationDb.select().from(dailyDessertInventoryTable))[0]?.quantity).toBe(0);
		});
	});

	describe("retrying a submission", () => {
		it("replays concurrent identical submissions with exactly one set of effects", async () => {
			const base = await seedInventory(2);
			const { combo } = await seedCombo(base.id, "Idempotent Combo", [{ price: 25, quantity: 1 }]);
			const data: CreateOrderInput = {
				submissionId: "10000000-0000-4000-8000-000000000001",
				customerName: "Concurrent Retry",
				lines: [line(base, 1, combo.id)],
				deliveryCost: "0.00",
			};
			const { writerPid, release, writer } = await lockCatalog(async (tx) => {
				await tx
					.select({ id: dessertsTable.id })
					.from(dessertsTable)
					.where(eq(dessertsTable.id, base.id))
					.for("update");
			});
			const firstCall = createOrder(data);
			await waitUntilBlockedBy(writerPid);
			const secondCall = createOrder(data);
			try {
				await waitForBlockedSessionCount(2);
			} finally {
				release();
			}
			const [first, second] = await Promise.all([firstCall, secondCall, writer]);

			expect(saved(first).orderId).toBe(saved(second).orderId);
			expect([saved(first).replayed, saved(second).replayed].sort()).toEqual([false, true]);
			expect(await integrationDb.select().from(ordersTable)).toHaveLength(1);
			expect(await integrationDb.select().from(orderItemsTable)).toHaveLength(1);
			expect(await integrationDb.select().from(orderItemModifiersTable)).toHaveLength(1);
			expect(await integrationDb.select().from(inventoryAuditLogTable)).toHaveLength(1);
			expect((await integrationDb.select().from(dailyDessertInventoryTable))[0]?.quantity).toBe(1);
		});

		it("refuses the same submission id for a different order without further changes", async () => {
			const dessert = await seedInventory(3);
			const data: CreateOrderInput = {
				submissionId: "10000000-0000-4000-8000-000000000002",
				customerName: "Original",
				lines: [line(dessert, 1)],
				deliveryCost: "0.00",
			};
			saved(await createOrder(data));

			await expect(createOrder({ ...data, customerName: "Changed" })).resolves.toEqual({
				ok: false,
				error: "This order submission was already used for different order details.",
			});
			expect(await integrationDb.select().from(ordersTable)).toHaveLength(1);
			expect(await integrationDb.select().from(orderItemsTable)).toHaveLength(1);
			expect(await integrationDb.select().from(inventoryAuditLogTable)).toHaveLength(1);
			expect((await integrationDb.select().from(dailyDessertInventoryTable))[0]?.quantity).toBe(2);
		});

		it("acknowledges a retry after catalog changes without saving or pricing it again", async () => {
			const dessert = await seedInventory(2);
			const data: CreateOrderInput = {
				submissionId: "10000000-0000-4000-8000-000000000003",
				customerName: "Catalog Retry",
				lines: [line(dessert, 1)],
				deliveryCost: "0.00",
			};
			const original = saved(await createOrder(data));
			await integrationDb
				.update(dessertsTable)
				.set({ enabled: false, isDeleted: true, name: "Unavailable", price: 999 })
				.where(eq(dessertsTable.id, dessert.id));

			await expect(createOrder(data)).resolves.toMatchObject({
				ok: true,
				data: { orderId: original.orderId, day: DAY, replayed: true },
			});
			expect((await integrationDb.select().from(ordersTable))[0]?.total).toBe("125.00");
			expect(await integrationDb.select().from(inventoryAuditLogTable)).toHaveLength(1);
		});
	});

	describe("refreshing caches", () => {
		it("refreshes the day's orders and stock on create and cancel, and compiles no analytics", async () => {
			const refreshesDay = (refreshed: readonly string[] | undefined) =>
				[dayOrdersTags(DAY), dayInventoryTags(DAY)].every((readTags) =>
					readTags.some((tag) => refreshed?.includes(tag)),
				);
			const dessert = await seedInventory(2);
			const placed = await placeOrder({ customerName: "Invalidate", lines: [line(dessert, 1)], deliveryCost: "0.00" });
			const { orderId } = saved(placed);
			expect(refreshesDay(placed.refreshed)).toBe(true);

			const cancelled = await cancelOrder(orderId);
			expect(cancelled.ok).toBe(true);
			expect(refreshesDay(cancelled.refreshed)).toBe(true);
			for (const table of [
				analyticsDailyRevenueTable,
				analyticsDailyDessertRevenueTable,
				analyticsDailyEodStockTable,
			]) {
				expect(await integrationDb.select().from(table)).toHaveLength(0);
			}
		});
	});

	describe("cancelling", () => {
		it("restores same-day stock and records the cancellation after the deduction", async () => {
			const dessert = await seedInventory(2);
			const { orderId } = saved(
				await placeOrder({ customerName: "Cancellation", lines: [line(dessert, 1)], deliveryCost: "0.00" }),
			);
			// Restoring follows the deduction audit, not the dessert's current stock setting.
			await integrationDb
				.update(dessertsTable)
				.set({ hasUnlimitedStock: true })
				.where(eq(dessertsTable.id, dessert.id));

			await expect(cancelOrder(orderId, "  integration cancellation  ")).resolves.toMatchObject({ ok: true });
			await expect(cancelOrder(orderId)).resolves.toEqual({ ok: false, error: "Order is already cancelled" });

			expect((await integrationDb.select().from(ordersTable))[0]?.status).toBe("cancelled");
			expect((await integrationDb.select().from(dailyDessertInventoryTable))[0]?.quantity).toBe(2);
			const audits = await integrationDb.select().from(inventoryAuditLogTable).orderBy(asc(inventoryAuditLogTable.id));
			expect(
				audits.map(({ action, previousQuantity, newQuantity, note }) => ({
					action,
					previousQuantity,
					newQuantity,
					note,
				})),
			).toEqual([
				{ action: "order_deducted", previousQuantity: 2, newQuantity: 1, note: null },
				{
					action: "order_cancelled",
					previousQuantity: 1,
					newQuantity: 2,
					note: cancellationNote("integration cancellation"),
				},
			]);
		});

		it("takes a dessert sold directly and in a combo as one deduction, and puts it all back", async () => {
			const dessert = await seedInventory(5);
			const { combo } = await seedCombo(dessert.id, "Shared Base Combo", [{ price: 25, quantity: 1 }]);
			const { orderId } = saved(
				await placeOrder({
					customerName: "Shared base",
					lines: [line(dessert, 1), line(dessert, 2, combo.id)],
					deliveryCost: "0.00",
				}),
			);
			expect((await integrationDb.select().from(dailyDessertInventoryTable))[0]?.quantity).toBe(2);

			await expect(cancelOrder(orderId)).resolves.toMatchObject({ ok: true });

			expect((await integrationDb.select().from(dailyDessertInventoryTable))[0]?.quantity).toBe(5);
			const audits = await integrationDb.select().from(inventoryAuditLogTable).orderBy(asc(inventoryAuditLogTable.id));
			expect(
				audits.map(({ action, previousQuantity, newQuantity }) => ({ action, previousQuantity, newQuantity })),
			).toEqual([
				{ action: "order_deducted", previousQuantity: 5, newQuantity: 2 },
				{ action: "order_cancelled", previousQuantity: 2, newQuantity: 5 },
			]);
		});

		it("stores the longest allowed reason in the audit note column", async () => {
			const dessert = await seedInventory(2);
			const { orderId } = saved(
				await placeOrder({ customerName: "Maximum cancellation", lines: [line(dessert, 1)], deliveryCost: "0.00" }),
			);
			const reason = "x".repeat(MAX_ORDER_CANCELLATION_REASON_LENGTH);

			await expect(cancelOrder(orderId, reason)).resolves.toMatchObject({ ok: true });

			const cancellation = (await integrationDb.select().from(inventoryAuditLogTable)).find(
				(audit) => audit.action === "order_cancelled",
			);
			expect(cancellation?.note).toBe(cancellationNote(reason));
			expect(cancellation?.note).toHaveLength(500);
		});

		it("cancels an unlimited-stock-only order without touching stock", async () => {
			const dessert = await seedInventory(2);
			await integrationDb
				.update(dessertsTable)
				.set({ hasUnlimitedStock: true })
				.where(eq(dessertsTable.id, dessert.id));
			const { orderId } = saved(
				await placeOrder({ customerName: "Unlimited", lines: [line(dessert, 1)], deliveryCost: "0.00" }),
			);

			await expect(cancelOrder(orderId)).resolves.toMatchObject({ ok: true });

			expect((await integrationDb.select().from(ordersTable))[0]?.status).toBe("cancelled");
			expect(await integrationDb.select().from(inventoryAuditLogTable)).toHaveLength(0);
			expect((await integrationDb.select().from(dailyDessertInventoryTable))[0]?.quantity).toBe(2);
		});

		it("refuses orders from a previous shop day and unknown orders", async () => {
			const dessert = await seedInventory(2);
			const { orderId } = saved(
				await placeOrder({ customerName: "Yesterday", lines: [line(dessert, 1)], deliveryCost: "0.00" }),
			);
			vi.setSystemTime(new Date("2026-07-15T18:30:00.000Z"));

			await expect(cancelOrder(orderId)).resolves.toEqual({
				ok: false,
				error: "Orders can only be cancelled on the day they were placed",
			});
			await expect(cancelOrder(orderId + 1)).resolves.toEqual({ ok: false, error: "Order not found" });
			expect((await integrationDb.select().from(ordersTable))[0]?.status).toBe("completed");
		});

		it("rolls back when a finite-stock deduction audit is missing", async () => {
			const dessert = await seedInventory(2);
			saved(await placeOrder({ customerName: "Missing audit", lines: [line(dessert, 1)], deliveryCost: "0.00" }));
			const orderId = await onlyOrderId();
			await integrationDb.delete(inventoryAuditLogTable).where(eq(inventoryAuditLogTable.orderId, orderId));

			await expect(cancelOrder(orderId)).rejects.toHaveProperty(
				"cause.message",
				"Order inventory audit does not match its items",
			);
			expect((await integrationDb.select().from(ordersTable))[0]?.status).toBe("completed");
			expect((await integrationDb.select().from(dailyDessertInventoryTable))[0]?.quantity).toBe(1);
		});

		it("rolls back when the deduction audit is malformed", async () => {
			const dessert = await seedInventory(2);
			saved(await placeOrder({ customerName: "Malformed", lines: [line(dessert, 1)], deliveryCost: "0.00" }));
			const orderId = await onlyOrderId();
			await integrationDb
				.update(inventoryAuditLogTable)
				.set({ previousQuantity: 1, newQuantity: 1 })
				.where(eq(inventoryAuditLogTable.orderId, orderId));

			await expect(cancelOrder(orderId)).rejects.toHaveProperty(
				"cause.message",
				"Order inventory audit evidence is malformed",
			);
			expect((await integrationDb.select().from(ordersTable))[0]?.status).toBe("completed");
			expect((await integrationDb.select().from(dailyDessertInventoryTable))[0]?.quantity).toBe(1);
		});
	});
});
