import { performance } from "node:perf_hooks";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { Effect } from "effect";
import { unstable_cache } from "next/cache";
import type { db as drizzleDb } from "@/db";
import {
	type Dessert,
	dailyDessertInventoryTable,
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
import { recomputeDayAnalyticsEffect } from "@/lib/recompute-day-analytics";
import { sanitizeCustomerName } from "@/lib/sanitize";
import type { CartLine } from "@/lib/types";
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

type OrderItemWithDessert = Omit<OrderItem, "dessertId" | "orderId"> & {
	dessert: Pick<Dessert, "id" | "name">;
	modifiers: OrderItemModifierWithDessert[];
};

export type OrderDetails = Omit<Order, "isDeleted"> & {
	orderItems: OrderItemWithDessert[];
};

export type GetOrdersReturnType = OrderDetails[];

export type SerializedOrderDetails = Omit<OrderDetails, "createdAt"> & {
	createdAt: string;
};

export type SerializedOrders = SerializedOrderDetails[];

type OrderMutationTag = (typeof OrderTags.mutation)[number] | (typeof OrderTags.delete)[number];

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
	customerName: string;
	lines: CartLine[];
	deliveryCost: string;
};

function refreshOrderMutationViewsEffect(date: Date, tags: readonly OrderMutationTag[] = OrderTags.mutation) {
	return Effect.gen(function* () {
		yield* recomputeDayAnalyticsEffect(date);
		yield* updateTagsEffect(tags);
	});
}

function refreshOrderMutationViewsAfterMutation(date: Date) {
	return refreshOrderMutationViewsEffect(date, OrderTags.mutation);
}

function refreshOrderMutationViewsAfterDelete(date: Date) {
	return refreshOrderMutationViewsEffect(date, OrderTags.delete);
}

function computeCartLineOrderTotal(lines: readonly CartLine[], deliveryCost: string) {
	return lines.reduce((acc, line) => acc + line.quantity * line.unitPrice, Number.parseFloat(deliveryCost)).toFixed(2);
}

export function getCartLineInventoryDeductions(lines: readonly CartLine[]): InventoryDeductionRequest[] {
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

function buildCartLineOrderItemInserts(orderId: number, lines: readonly CartLine[]) {
	return lines.map((line) => ({
		orderId,
		dessertId: line.baseDessertId,
		quantity: line.quantity,
		unitPrice: line.unitPrice.toFixed(2),
		comboId: line.comboId,
		comboName: line.comboName,
	}));
}

function buildOrderItemModifierInserts(lines: readonly CartLine[], insertedItems: readonly InsertedOrderItem[]) {
	return lines.flatMap((line, index) =>
		line.modifiers.map((modifier) => ({
			orderItemId: insertedItems[index].id,
			dessertId: modifier.dessertId,
			quantity: modifier.quantity,
		})),
	);
}

export function canCancelOrderOnOperatingDay(orderCreatedAt: Date, now = new Date()) {
	return getAnalyticsDay(orderCreatedAt).getTime() === getAnalyticsDay(now).getTime();
}

function mapMovementsByDessertId(movements: readonly OrderInventoryMovement[]) {
	return {
		ids: movements.map((item) => item.dessertId),
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

function getOrderInventoryRestorations(
	orderItems: ReadonlyArray<{ dessertId: number; quantity: number }>,
	desserts: ReadonlyArray<Pick<Dessert, "id" | "name" | "hasUnlimitedStock">>,
): OrderInventoryMovement[] {
	const dessertMap = new Map(desserts.map((dessert) => [dessert.id, dessert]));
	const quantityToRestore = new Map<number, OrderInventoryMovement>();

	for (const item of orderItems) {
		const dessert = dessertMap.get(item.dessertId);
		if (!dessert || dessert.hasUnlimitedStock) continue;

		const existing = quantityToRestore.get(item.dessertId);
		if (existing) {
			existing.quantity += item.quantity;
		} else {
			quantityToRestore.set(item.dessertId, {
				dessertId: item.dessertId,
				quantity: item.quantity,
				name: dessert.name,
			});
		}
	}

	return Array.from(quantityToRestore.values());
}

function createCompletedOrderEffect(data: CreateCompletedOrderInput, userId: string) {
	const sanitizedCustomerName = sanitizeCustomerName(data.customerName);
	const day = getAnalyticsDay();
	const now = new Date();
	const inventoryDeductions = getCartLineInventoryDeductions(data.lines);

	return Effect.gen(function* () {
		const database = yield* Database;

		const order = yield* database.attempt("create completed order", (db) =>
			db.transaction(async (tx) => {
				const [order] = await tx
					.insert(ordersTable)
					.values({
						customerName: sanitizedCustomerName,
						createdAt: now,
						status: "completed",
						total: computeCartLineOrderTotal(data.lines, data.deliveryCost),
						deliveryCost: data.deliveryCost,
					})
					.returning();

				const insertedItems = await tx
					.insert(orderItemsTable)
					.values(buildCartLineOrderItemInserts(order.id, data.lines))
					.returning({ id: orderItemsTable.id });

				const modifierInserts = buildOrderItemModifierInserts(data.lines, insertedItems);

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

				return order;
			}),
		);

		yield* refreshOrderMutationViewsAfterMutation(order.createdAt);
		return order;
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
					dessert: {
						columns: {
							id: true,
							name: true,
						},
					},
					modifiers: {
						columns: {
							orderItemId: false,
							dessertId: false,
						},
						with: {
							dessert: {
								columns: {
									id: true,
									name: true,
								},
							},
						},
					},
				},
				columns: {
					dessertId: false,
					orderId: false,
				},
			},
		},
	});
	const duration = performance.now() - start;
	console.log(`getOrders: ${duration}ms`);

	return orders as GetOrdersReturnType;
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

export async function createCompletedOrder(data: CreateCompletedOrderInput, userId: string) {
	await runOrderLifecycleOperation("createCompletedOrder", () =>
		runNextAppEffect(createCompletedOrderEffect(data, userId)),
	);
}

function softDeleteOrderEffect(orderId: number) {
	return Effect.gen(function* () {
		const database = yield* Database;

		const [order] = yield* database.attempt("soft delete order", (db) =>
			db
				.update(ordersTable)
				.set({ isDeleted: true })
				.where(eq(ordersTable.id, orderId))
				.returning({ createdAt: ordersTable.createdAt }),
		);

		if (order) {
			yield* refreshOrderMutationViewsAfterDelete(order.createdAt);
			return;
		}

		yield* updateTagsEffect(OrderTags.delete);
	});
}

function cancelOrderAsNormalPathEffect(orderId: number, userId: string, reason?: string, now = new Date()) {
	const day = getAnalyticsDay(now);

	return Effect.gen(function* () {
		const database = yield* Database;

		const order = yield* database.attempt("cancel order", (db) =>
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
						id: orderItemsTable.id,
						dessertId: orderItemsTable.dessertId,
						quantity: orderItemsTable.quantity,
					})
					.from(orderItemsTable)
					.where(eq(orderItemsTable.orderId, orderId));

				if (orderItems.length === 0) {
					throw new Error("Order has no items");
				}

				const dessertIds = [...new Set(orderItems.map((item) => item.dessertId))];
				const desserts = await tx
					.select({
						id: dessertsTable.id,
						name: dessertsTable.name,
						hasUnlimitedStock: dessertsTable.hasUnlimitedStock,
					})
					.from(dessertsTable)
					.where(inArray(dessertsTable.id, dessertIds));

				const inventoryRestorations = getOrderInventoryRestorations(orderItems, desserts);

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

		yield* refreshOrderMutationViewsAfterMutation(order.createdAt);
	});
}

export async function softDeleteOrder(orderId: number) {
	await runOrderLifecycleOperation("deleteOrder", () => runNextAppEffect(softDeleteOrderEffect(orderId)));
}

export async function cancelOrderAsNormalPath(orderId: number, userId: string, reason?: string) {
	await runOrderLifecycleOperation("cancelOrder", () =>
		runNextAppEffect(cancelOrderAsNormalPathEffect(orderId, userId, reason)),
	);
}
