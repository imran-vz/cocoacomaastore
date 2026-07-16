import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { Effect } from "effect";
import { unstable_cache } from "next/cache";
import type { db as drizzleDb } from "@/db";
import {
	type Dessert,
	dailyDessertInventoryTable,
	dessertComboItemsTable,
	dessertCombosTable,
	dessertsTable,
	inventoryAuditLogTable,
	type Order,
	type OrderItem,
	orderItemModifiersTable,
	orderItemsTable,
	ordersTable,
} from "@/db/schema";
import { isDatabaseUnavailableError } from "@/lib/errors";
import { getAnalyticsDay, getDayKey, getEndOfDayIST, getStartOfDayIST } from "@/lib/ist-date";
import { sanitizeCustomerName } from "@/lib/sanitize";
import type { OrderRequestLine } from "@/lib/types";
import { CacheTag, OrderTags, updateTagsEffect } from "@/server/effect/cache-tags";
import { runNextAppEffect } from "@/server/effect/next-runtime";
import { Database } from "@/server/effect/services/db";

type AppDatabase = typeof drizzleDb;
type OrderTransaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

type OrderItemModifierWithDessert = {
	id: number;
	quantity: number;
	dessert: Pick<Dessert, "id" | "name">;
};

type OrderItemWithDessert = Omit<OrderItem, "baseDessertName" | "dessertId" | "inventoryDeducted" | "orderId"> & {
	dessert: Pick<Dessert, "id" | "name">;
	modifiers: OrderItemModifierWithDessert[];
};

export type OrderDetails = Omit<Order, "isDeleted" | "requestFingerprint" | "submissionId"> & {
	orderItems: OrderItemWithDessert[];
};

export type GetOrdersReturnType = OrderDetails[];

export type SerializedOrderDetails = Omit<OrderDetails, "createdAt"> & {
	createdAt: string;
};

export type SerializedOrders = SerializedOrderDetails[];

export type InventoryDeductionRequest = {
	dessertId: number;
	quantity: number;
	name: string;
};

type InsertedOrderItem = {
	id: number;
};

type OrderInventoryMovement = {
	dessertId: number;
	quantity: number;
	name: string;
};

type OrderInventoryMovementDirection = "deduct" | "restore";

type OrderInventoryAudit = {
	action: "order_deducted" | "order_cancelled";
	orderId: number;
	userId: string;
	note?: string;
};

export type CreateCompletedOrderInput = {
	submissionId: string;
	customerName: string;
	lines: OrderRequestLine[];
	deliveryCost: string;
};

export type CreateCompletedOrderResult = {
	orderId: number;
	replayed: boolean;
	refreshWarning: boolean;
};

export class OrderSubmissionConflictError extends Error {
	constructor() {
		super("This order submission was already used for different order details.");
		this.name = "OrderSubmissionConflictError";
	}
}

type CatalogDessert = Pick<Dessert, "enabled" | "hasUnlimitedStock" | "id" | "isDeleted" | "kind" | "name" | "price">;

type CatalogCombo = {
	baseDessertId: number;
	enabled: boolean;
	id: number;
	isDeleted: boolean;
	name: string;
	overridePrice: number | null;
};

type CatalogComboItem = {
	comboId: number;
	dessertId: number;
	quantity: number;
};

type ResolvedOrderLine = {
	baseDessertId: number;
	baseDessertName: string;
	comboId: number | null;
	comboName: string | null;
	hasUnlimitedStock: boolean;
	modifiers: Array<{ dessertId: number; dessertName: string; quantity: number }>;
	quantity: number;
	unitPrice: number;
};

const MAX_ORDER_TOTAL_CENTS = 9_999_999_999;
const MAX_UNIT_PRICE = 99_999_999;

function invalidateOrderMutationCachesEffect(tags: readonly string[] = OrderTags.mutation) {
	return updateTagsEffect(tags);
}

function parseDeliveryCostCents(deliveryCost: string) {
	const [whole, fraction = ""] = deliveryCost.split(".");
	return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function fingerprintOrderRequest(data: CreateCompletedOrderInput) {
	const normalized = {
		customerName: sanitizeCustomerName(data.customerName),
		deliveryCost: (parseDeliveryCostCents(data.deliveryCost) / 100).toFixed(2),
		lines: data.lines
			.map((line) => ({
				baseDessertId: line.baseDessertId,
				comboId: line.comboId ?? null,
				quantity: line.quantity,
			}))
			.sort(
				(left, right) =>
					left.baseDessertId - right.baseDessertId ||
					(left.comboId ?? -1) - (right.comboId ?? -1) ||
					left.quantity - right.quantity,
			),
	};

	return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function computeOrderTotal(lines: readonly ResolvedOrderLine[], deliveryCost: string) {
	const totalCents = lines.reduce(
		(total, line) => total + line.quantity * line.unitPrice * 100,
		parseDeliveryCostCents(deliveryCost),
	);
	if (!Number.isSafeInteger(totalCents) || totalCents > MAX_ORDER_TOTAL_CENTS) {
		throw new Error("Order total exceeds the supported amount");
	}
	return (totalCents / 100).toFixed(2);
}

function assertValidFinalUnitPrice(unitPrice: number) {
	if (!Number.isSafeInteger(unitPrice) || unitPrice < 0 || unitPrice > MAX_UNIT_PRICE) {
		throw new Error("Order line price exceeds the supported amount");
	}
}

export function resolveOrderLinesFromCatalog({
	lines,
	desserts,
	combos,
	comboItems,
}: {
	lines: readonly OrderRequestLine[];
	desserts: readonly CatalogDessert[];
	combos: readonly CatalogCombo[];
	comboItems: readonly CatalogComboItem[];
}): ResolvedOrderLine[] {
	const dessertById = new Map(desserts.map((dessert) => [dessert.id, dessert]));
	const comboById = new Map(combos.map((combo) => [combo.id, combo]));
	const itemsByComboId = new Map<number, CatalogComboItem[]>();

	for (const item of comboItems) {
		const items = itemsByComboId.get(item.comboId) ?? [];
		items.push(item);
		itemsByComboId.set(item.comboId, items);
	}

	const references = new Set<string>();
	return lines.map((line) => {
		const reference = `${line.baseDessertId}:${line.comboId ?? "direct"}`;
		if (references.has(reference)) {
			throw new Error("Duplicate order line reference");
		}
		references.add(reference);

		const base = dessertById.get(line.baseDessertId);
		if (!base || base.kind !== "base" || base.isDeleted || !base.enabled) {
			throw new Error("Base dessert is missing or inactive");
		}
		assertValidFinalUnitPrice(base.price);

		if (line.comboId === undefined) {
			return {
				baseDessertId: base.id,
				baseDessertName: base.name,
				comboId: null,
				comboName: null,
				hasUnlimitedStock: base.hasUnlimitedStock,
				modifiers: [],
				quantity: line.quantity,
				unitPrice: base.price,
			};
		}

		const combo = comboById.get(line.comboId);
		if (!combo || combo.isDeleted || !combo.enabled) {
			throw new Error("Combo is missing or inactive");
		}
		if (combo.baseDessertId !== base.id) {
			throw new Error("Combo does not match the requested base dessert");
		}

		const modifiers = (itemsByComboId.get(combo.id) ?? []).map((item) => {
			const modifier = dessertById.get(item.dessertId);
			if (!modifier || modifier.kind !== "modifier" || modifier.isDeleted || !modifier.enabled) {
				throw new Error("Combo modifier is missing or inactive");
			}
			if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
				throw new Error("Combo modifier quantity is invalid");
			}
			assertValidFinalUnitPrice(modifier.price);
			return {
				dessertId: modifier.id,
				dessertName: modifier.name,
				quantity: item.quantity,
			};
		});
		const additivePrice = (itemsByComboId.get(combo.id) ?? []).reduce((total, item) => {
			const modifier = dessertById.get(item.dessertId);
			return total + (modifier?.price ?? 0) * item.quantity;
		}, base.price);
		const unitPrice = combo.overridePrice ?? additivePrice;
		assertValidFinalUnitPrice(unitPrice);

		return {
			baseDessertId: base.id,
			baseDessertName: base.name,
			comboId: combo.id,
			comboName: combo.name,
			hasUnlimitedStock: base.hasUnlimitedStock,
			modifiers,
			quantity: line.quantity,
			unitPrice,
		};
	});
}

async function resolveAndLockOrderLines(tx: OrderTransaction, lines: readonly OrderRequestLine[]) {
	const comboIds = [...new Set(lines.flatMap((line) => (line.comboId === undefined ? [] : [line.comboId])))].sort(
		(a, b) => a - b,
	);
	const combos =
		comboIds.length === 0
			? []
			: await tx
					.select({
						id: dessertCombosTable.id,
						name: dessertCombosTable.name,
						baseDessertId: dessertCombosTable.baseDessertId,
						overridePrice: dessertCombosTable.overridePrice,
						enabled: dessertCombosTable.enabled,
						isDeleted: dessertCombosTable.isDeleted,
					})
					.from(dessertCombosTable)
					.where(inArray(dessertCombosTable.id, comboIds))
					.orderBy(asc(dessertCombosTable.id))
					.for("no key update");

	if (combos.length !== comboIds.length) {
		throw new Error("Combo is missing or inactive");
	}

	const comboItems =
		comboIds.length === 0
			? []
			: await tx
					.select({
						comboId: dessertComboItemsTable.comboId,
						dessertId: dessertComboItemsTable.dessertId,
						quantity: dessertComboItemsTable.quantity,
					})
					.from(dessertComboItemsTable)
					.where(inArray(dessertComboItemsTable.comboId, comboIds))
					.orderBy(asc(dessertComboItemsTable.comboId), asc(dessertComboItemsTable.dessertId))
					.for("no key update");

	const dessertIds = [
		...new Set([...lines.map((line) => line.baseDessertId), ...comboItems.map((item) => item.dessertId)]),
	].sort((a, b) => a - b);
	const desserts = await tx
		.select({
			id: dessertsTable.id,
			name: dessertsTable.name,
			price: dessertsTable.price,
			kind: dessertsTable.kind,
			enabled: dessertsTable.enabled,
			isDeleted: dessertsTable.isDeleted,
			hasUnlimitedStock: dessertsTable.hasUnlimitedStock,
		})
		.from(dessertsTable)
		.where(inArray(dessertsTable.id, dessertIds))
		.orderBy(asc(dessertsTable.id))
		.for("no key update");

	return resolveOrderLinesFromCatalog({ lines, desserts, combos, comboItems });
}

export function getCartLineInventoryDeductions(lines: readonly ResolvedOrderLine[]): InventoryDeductionRequest[] {
	const inventoryAggregation = new Map<number, InventoryDeductionRequest>();

	for (const line of lines) {
		if (line.hasUnlimitedStock) continue;

		const existing = inventoryAggregation.get(line.baseDessertId);
		if (existing) {
			existing.quantity += line.quantity;
		} else {
			inventoryAggregation.set(line.baseDessertId, {
				dessertId: line.baseDessertId,
				quantity: line.quantity,
				name: line.baseDessertName,
			});
		}
	}

	return Array.from(inventoryAggregation.values());
}

function buildCartLineOrderItemInserts(orderId: number, lines: readonly ResolvedOrderLine[]) {
	return lines.map((line) => ({
		orderId,
		dessertId: line.baseDessertId,
		baseDessertName: line.baseDessertName,
		inventoryDeducted: !line.hasUnlimitedStock,
		quantity: line.quantity,
		unitPrice: line.unitPrice.toFixed(2),
		comboId: line.comboId,
		comboName: line.comboName,
	}));
}

function buildOrderItemModifierInserts(
	lines: readonly ResolvedOrderLine[],
	insertedItems: readonly InsertedOrderItem[],
) {
	return lines.flatMap((line, index) =>
		line.modifiers.map((modifier) => ({
			orderItemId: insertedItems[index].id,
			dessertId: modifier.dessertId,
			dessertName: modifier.dessertName,
			quantity: modifier.quantity,
		})),
	);
}

export function canCancelOrderOnOperatingDay(orderCreatedAt: Date, now = new Date()) {
	return getAnalyticsDay(orderCreatedAt).getTime() === getAnalyticsDay(now).getTime();
}

function mapMovementsByDessertId(movements: readonly OrderInventoryMovement[]) {
	return {
		ids: movements.map((item) => item.dessertId).sort((a, b) => a - b),
		quantityByDessertId: new Map(movements.map((item) => [item.dessertId, item.quantity])),
		nameByDessertId: new Map(movements.map((item) => [item.dessertId, item.name])),
	};
}

function buildInventoryUpdateCaseStatements({
	dessertIds,
	quantityByDessertId,
	direction,
}: {
	dessertIds: readonly number[];
	quantityByDessertId: ReadonlyMap<number, number>;
	direction: OrderInventoryMovementDirection;
}) {
	return dessertIds
		.map((dessertId) => {
			const quantity = quantityByDessertId.get(dessertId) ?? 0;
			const nextQuantity =
				direction === "deduct"
					? sql`${dailyDessertInventoryTable.quantity} - ${quantity}`
					: sql`${dailyDessertInventoryTable.quantity} + ${quantity}`;
			return sql`WHEN ${dailyDessertInventoryTable.dessertId} = ${dessertId} THEN ${nextQuantity}`;
		})
		.reduce((acc, curr) => sql`${acc} ${curr}`);
}

async function applyOrderInventoryMovement({
	tx,
	day,
	now,
	movements,
	direction,
	audit,
}: {
	tx: OrderTransaction;
	day: Date;
	now: Date;
	movements: readonly OrderInventoryMovement[];
	direction: OrderInventoryMovementDirection;
	audit: OrderInventoryAudit;
}) {
	if (movements.length === 0) return;

	const { ids: dessertIds, quantityByDessertId, nameByDessertId } = mapMovementsByDessertId(movements);
	const lockedInventory = await tx
		.select({
			dessertId: dailyDessertInventoryTable.dessertId,
			quantity: dailyDessertInventoryTable.quantity,
		})
		.from(dailyDessertInventoryTable)
		.where(and(eq(dailyDessertInventoryTable.day, day), inArray(dailyDessertInventoryTable.dessertId, dessertIds)))
		.orderBy(asc(dailyDessertInventoryTable.dessertId))
		.for("update");

	const stockMap = new Map(lockedInventory.map((row) => [row.dessertId, row.quantity]));

	if (direction === "deduct") {
		for (const dessertId of dessertIds) {
			const currentStock = stockMap.get(dessertId) ?? 0;
			const requestedQty = quantityByDessertId.get(dessertId) ?? 0;
			if (currentStock < requestedQty) {
				const name = nameByDessertId.get(dessertId) ?? "Unknown";
				throw new Error(`Insufficient stock for ${name}. Available: ${currentStock}, Requested: ${requestedQty}`);
			}
		}
	}

	const updated = await tx
		.update(dailyDessertInventoryTable)
		.set({
			quantity: sql`CASE ${buildInventoryUpdateCaseStatements({ dessertIds, quantityByDessertId, direction })} ELSE ${dailyDessertInventoryTable.quantity} END`,
			updatedAt: now,
		})
		.where(and(eq(dailyDessertInventoryTable.day, day), inArray(dailyDessertInventoryTable.dessertId, dessertIds)))
		.returning({
			dessertId: dailyDessertInventoryTable.dessertId,
			newQuantity: dailyDessertInventoryTable.quantity,
		});

	const updatedIds = new Set(updated.map((row) => row.dessertId));
	for (const dessertId of dessertIds) {
		if (!updatedIds.has(dessertId)) {
			const name = nameByDessertId.get(dessertId) ?? "Unknown";
			throw new Error(`Failed to update inventory for ${name} (unexpected error)`);
		}
	}

	await tx.insert(inventoryAuditLogTable).values(
		updated.map((row) => {
			const quantity = quantityByDessertId.get(row.dessertId) ?? 0;
			return {
				day,
				dessertId: row.dessertId,
				action: audit.action,
				previousQuantity: direction === "deduct" ? row.newQuantity + quantity : row.newQuantity - quantity,
				newQuantity: row.newQuantity,
				orderId: audit.orderId,
				userId: audit.userId,
				note: audit.note,
				createdAt: now,
			};
		}),
	);
}

export function getOrderInventoryRestorationsFromAudits(
	audits: ReadonlyArray<{
		day: Date;
		dessertId: number | null;
		newQuantity: number;
		previousQuantity: number;
	}>,
	orderItems: ReadonlyArray<{
		baseDessertName: string;
		dessertId: number;
		inventoryDeducted: boolean;
	}>,
	day: Date,
): OrderInventoryMovement[] {
	const expectedItems = new Map<number, string>();
	for (const item of orderItems) {
		if (item.inventoryDeducted) expectedItems.set(item.dessertId, item.baseDessertName);
	}

	const seenDessertIds = new Set<number>();
	const restorations = audits.map((audit) => {
		const quantity = audit.previousQuantity - audit.newQuantity;
		if (
			audit.dessertId === null ||
			audit.day.getTime() !== day.getTime() ||
			audit.previousQuantity < 0 ||
			audit.newQuantity < 0 ||
			!Number.isSafeInteger(quantity) ||
			quantity <= 0 ||
			seenDessertIds.has(audit.dessertId)
		) {
			throw new Error("Order inventory audit evidence is malformed");
		}

		const name = expectedItems.get(audit.dessertId);
		if (!name) {
			throw new Error("Order inventory audit does not match its items");
		}
		seenDessertIds.add(audit.dessertId);
		return { dessertId: audit.dessertId, quantity, name };
	});

	if (seenDessertIds.size !== expectedItems.size) {
		throw new Error("Order inventory audit does not match its items");
	}

	return restorations;
}

function createCompletedOrderEffect(data: CreateCompletedOrderInput, userId: string) {
	const sanitizedCustomerName = sanitizeCustomerName(data.customerName);
	const requestFingerprint = fingerprintOrderRequest(data);
	const day = getAnalyticsDay();
	const now = new Date();

	return Effect.gen(function* () {
		const database = yield* Database;

		return yield* database
			.attempt("create completed order", (db) =>
				db.transaction(async (tx) => {
					const [claimedOrder] = await tx
						.insert(ordersTable)
						.values({
							submissionId: data.submissionId,
							requestFingerprint,
							customerName: sanitizedCustomerName,
							createdAt: now,
							status: "completed",
							total: "0.00",
							deliveryCost: data.deliveryCost,
						})
						.onConflictDoNothing({ target: ordersTable.submissionId })
						.returning();

					if (!claimedOrder) {
						const [winner] = await tx.select().from(ordersTable).where(eq(ordersTable.submissionId, data.submissionId));
						if (!winner) {
							throw new Error("Order submission winner was not visible");
						}
						if (winner.requestFingerprint !== requestFingerprint) {
							throw new OrderSubmissionConflictError();
						}
						return { order: winner, replayed: true } as const;
					}

					const resolvedLines = await resolveAndLockOrderLines(tx, data.lines);
					const inventoryDeductions = getCartLineInventoryDeductions(resolvedLines);
					const total = computeOrderTotal(resolvedLines, data.deliveryCost);
					const [order] = await tx
						.update(ordersTable)
						.set({ total })
						.where(eq(ordersTable.id, claimedOrder.id))
						.returning();

					const insertedItems = await tx
						.insert(orderItemsTable)
						.values(buildCartLineOrderItemInserts(order.id, resolvedLines))
						.returning({ id: orderItemsTable.id });

					const modifierInserts = buildOrderItemModifierInserts(resolvedLines, insertedItems);

					if (modifierInserts.length > 0) {
						await tx.insert(orderItemModifiersTable).values(modifierInserts);
					}

					await applyOrderInventoryMovement({
						tx,
						day,
						now,
						movements: inventoryDeductions,
						direction: "deduct",
						audit: {
							action: "order_deducted",
							orderId: order.id,
							userId,
						},
					});

					return { order, replayed: false } as const;
				}),
			)
			.pipe(
				Effect.catchTag("BackendDatabaseError", (error) =>
					error.cause instanceof OrderSubmissionConflictError ? Effect.fail(error.cause) : Effect.fail(error),
				),
			);
	});
}

export async function getOrders(date?: Date): Promise<GetOrdersReturnType> {
	const start = performance.now();
	const dayStart = getStartOfDayIST(date);
	const dayEnd = getEndOfDayIST(date);
	const { db } = await import("@/db");

	const orders = await db.query.ordersTable.findMany({
		columns: {
			isDeleted: false,
			requestFingerprint: false,
			submissionId: false,
		},
		where: and(
			eq(ordersTable.isDeleted, false),
			gte(ordersTable.createdAt, dayStart),
			lt(ordersTable.createdAt, dayEnd),
		),
		orderBy: [desc(ordersTable.createdAt)],
		with: {
			orderItems: {
				with: {
					modifiers: {
						columns: {
							orderItemId: false,
						},
					},
				},
				columns: {
					orderId: false,
				},
			},
		},
	});
	const duration = performance.now() - start;
	console.log(`getOrders: ${duration}ms`);

	return orders.map((order) => ({
		...order,
		orderItems: order.orderItems.map(({ baseDessertName, dessertId, inventoryDeducted: _, modifiers, ...item }) => ({
			...item,
			dessert: { id: dessertId, name: baseDessertName },
			modifiers: modifiers.map(({ dessertId: modifierDessertId, dessertName, ...modifier }) => ({
				...modifier,
				dessert: { id: modifierDessertId, name: dessertName },
			})),
		})),
	}));
}

export async function getCachedOrders(date?: Date) {
	const day = date ? getAnalyticsDay(date) : getAnalyticsDay();
	const dayKey = getDayKey(day);

	return unstable_cache(() => getOrders(date), [CacheTag.orders, dayKey], {
		revalidate: 60 * 60 * 24,
		tags: [CacheTag.orders],
	})();
}

export function serializeOrders(orders: GetOrdersReturnType): SerializedOrders {
	return orders.map((order) => ({
		...order,
		createdAt: order.createdAt.toISOString(),
	}));
}

async function runOrderLifecycleOperation<T>(label: string, run: () => Promise<T>): Promise<T> {
	const start = performance.now();
	try {
		const result = await run();
		console.log(`${label}: ${performance.now() - start}ms`);
		return result;
	} catch (error) {
		if (isDatabaseUnavailableError(error)) {
			throw new Error("Database is unavailable. Please try again.", { cause: error });
		}
		throw error;
	}
}

export async function createCompletedOrder(
	data: CreateCompletedOrderInput,
	userId: string,
): Promise<CreateCompletedOrderResult> {
	const created: { order: Order; replayed: boolean } = await runOrderLifecycleOperation("createCompletedOrder", () =>
		runNextAppEffect(createCompletedOrderEffect(data, userId)),
	);

	let refreshWarning = false;
	try {
		await runNextAppEffect(invalidateOrderMutationCachesEffect());
	} catch (error) {
		refreshWarning = true;
		console.error("Order was saved, but order caches could not be invalidated", error);
	}

	return { orderId: created.order.id, replayed: created.replayed, refreshWarning };
}

function cancelOrderAsNormalPathEffect(orderId: number, userId: string, reason?: string, now = new Date()) {
	const day = getAnalyticsDay(now);

	return Effect.gen(function* () {
		const database = yield* Database;

		yield* database.attempt("cancel order", (db) =>
			db.transaction(async (tx) => {
				const [order] = await tx
					.select({
						id: ordersTable.id,
						status: ordersTable.status,
						isDeleted: ordersTable.isDeleted,
						createdAt: ordersTable.createdAt,
					})
					.from(ordersTable)
					.where(eq(ordersTable.id, orderId))
					.for("update");

				if (!order) {
					throw new Error("Order not found");
				}

				if (order.isDeleted) {
					throw new Error("Cannot cancel a deleted order");
				}

				if (order.status === "cancelled") {
					throw new Error("Order is already cancelled");
				}

				if (!canCancelOrderOnOperatingDay(order.createdAt, now)) {
					throw new Error("Cannot cancel an order from a previous operating day");
				}

				const orderItems = await tx
					.select({
						dessertId: orderItemsTable.dessertId,
						baseDessertName: orderItemsTable.baseDessertName,
						inventoryDeducted: orderItemsTable.inventoryDeducted,
					})
					.from(orderItemsTable)
					.where(eq(orderItemsTable.orderId, orderId));

				if (orderItems.length === 0) {
					throw new Error("Order has no items");
				}

				const deductionAudits = await tx
					.select({
						day: inventoryAuditLogTable.day,
						dessertId: inventoryAuditLogTable.dessertId,
						previousQuantity: inventoryAuditLogTable.previousQuantity,
						newQuantity: inventoryAuditLogTable.newQuantity,
					})
					.from(inventoryAuditLogTable)
					.where(and(eq(inventoryAuditLogTable.orderId, orderId), eq(inventoryAuditLogTable.action, "order_deducted")))
					.orderBy(asc(inventoryAuditLogTable.id));

				const inventoryRestorations = getOrderInventoryRestorationsFromAudits(deductionAudits, orderItems, day);

				await tx.update(ordersTable).set({ status: "cancelled" }).where(eq(ordersTable.id, orderId));

				await applyOrderInventoryMovement({
					tx,
					day,
					now,
					movements: inventoryRestorations,
					direction: "restore",
					audit: {
						action: "order_cancelled",
						orderId,
						userId,
						note: reason ? `Order cancelled: ${reason}` : "Order cancelled - stock restored",
					},
				});

				return order;
			}),
		);

		yield* invalidateOrderMutationCachesEffect();
	});
}

export async function cancelOrderAsNormalPath(orderId: number, userId: string, reason?: string) {
	await runOrderLifecycleOperation("cancelOrder", () =>
		runNextAppEffect(cancelOrderAsNormalPathEffect(orderId, userId, reason)),
	);
}
