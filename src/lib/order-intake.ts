import { performance } from "node:perf_hooks";
import { and, eq, sql } from "drizzle-orm";
import { Effect } from "effect";
import {
	dailyDessertInventoryTable,
	inventoryAuditLogTable,
	type Order,
	orderItemModifiersTable,
	orderItemsTable,
	ordersTable,
} from "@/db/schema";
import { isDatabaseUnavailableError } from "@/lib/errors";
import { getAnalyticsDay } from "@/lib/ist-date";
import { recomputeDayAnalyticsEffect } from "@/lib/recompute-day-analytics";
import { sanitizeCustomerName } from "@/lib/sanitize";
import type { CartLine } from "@/lib/types";
import { updateTagsEffect } from "@/server/effect/cache-tags";
import { runNextAppEffect } from "@/server/effect/next-runtime";

export const ORDER_MUTATION_TAGS = ["orders", "inventory", "dashboard", "analytics"] as const;
export const ORDER_DELETE_TAGS = ["orders", "dashboard", "analytics"] as const;

export type OrderMutationTag = (typeof ORDER_MUTATION_TAGS)[number] | (typeof ORDER_DELETE_TAGS)[number];

export type InventoryDeductionRequest = {
	dessertId: number;
	quantity: number;
	name: string;
};

export type InsertedOrderItem = {
	id: number;
};

export type CreateCompletedOrderInput = {
	customerName: string;
	lines: CartLine[];
	deliveryCost: string;
};

export function refreshOrderMutationViewsEffect(date: Date, tags: readonly OrderMutationTag[] = ORDER_MUTATION_TAGS) {
	return Effect.gen(function* () {
		yield* recomputeDayAnalyticsEffect(date);
		yield* updateTagsEffect(tags);
	});
}

export async function refreshOrderMutationViews(date: Date, tags: readonly OrderMutationTag[] = ORDER_MUTATION_TAGS) {
	await runNextAppEffect(refreshOrderMutationViewsEffect(date, tags));
}

export function computeCartLineOrderTotal(lines: readonly CartLine[], deliveryCost: string) {
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

export function buildCartLineOrderItemInserts(orderId: number, lines: readonly CartLine[]) {
	return lines.map((line) => ({
		orderId,
		dessertId: line.baseDessertId,
		quantity: line.quantity,
		unitPrice: line.unitPrice.toFixed(2),
		comboId: line.comboId,
		comboName: line.comboName,
	}));
}

export function buildOrderItemModifierInserts(lines: readonly CartLine[], insertedItems: readonly InsertedOrderItem[]) {
	return lines.flatMap((line, index) =>
		line.modifiers.map((modifier) => ({
			orderItemId: insertedItems[index].id,
			dessertId: modifier.dessertId,
			quantity: modifier.quantity,
		})),
	);
}

export async function createCompletedOrder(data: CreateCompletedOrderInput, userId: string) {
	const sanitizedCustomerName = sanitizeCustomerName(data.customerName);
	const start = performance.now();
	const day = getAnalyticsDay();
	const now = new Date();
	const inventoryDeductions = getCartLineInventoryDeductions(data.lines);
	const dessertIds = inventoryDeductions.map((item) => item.dessertId);
	const quantityByDessertId = new Map(inventoryDeductions.map((item) => [item.dessertId, item.quantity]));
	const nameByDessertId = new Map(inventoryDeductions.map((item) => [item.dessertId, item.name]));

	let order: Order;
	try {
		const { db } = await import("@/db");

		order = await db.transaction(async (tx) => {
			let inventoryUpdates: {
				dessertId: number;
				previousQuantity: number;
				newQuantity: number;
			}[] = [];

			if (dessertIds.length > 0) {
				const lockedInventory = await tx
					.select({
						dessertId: dailyDessertInventoryTable.dessertId,
						quantity: dailyDessertInventoryTable.quantity,
					})
					.from(dailyDessertInventoryTable)
					.where(
						and(
							eq(dailyDessertInventoryTable.day, day),
							sql`${dailyDessertInventoryTable.dessertId} IN (${sql.join(dessertIds, sql`, `)})`,
						),
					)
					.for("update");

				const stockMap = new Map(lockedInventory.map((row) => [row.dessertId, row.quantity]));

				for (const dessertId of dessertIds) {
					const currentStock = stockMap.get(dessertId) ?? 0;
					const requestedQty = quantityByDessertId.get(dessertId) ?? 0;
					if (currentStock < requestedQty) {
						const name = nameByDessertId.get(dessertId) ?? "Unknown";
						throw new Error(`Insufficient stock for ${name}. Available: ${currentStock}, Requested: ${requestedQty}`);
					}
				}

				const caseStatements = dessertIds
					.map(
						(dessertId) =>
							sql`WHEN ${dailyDessertInventoryTable.dessertId} = ${dessertId} THEN ${dailyDessertInventoryTable.quantity} - ${quantityByDessertId.get(dessertId)}`,
					)
					.reduce((acc, curr) => sql`${acc} ${curr}`);

				const updated = await tx
					.update(dailyDessertInventoryTable)
					.set({
						quantity: sql`CASE ${caseStatements} ELSE ${dailyDessertInventoryTable.quantity} END`,
						updatedAt: now,
					})
					.where(
						and(
							eq(dailyDessertInventoryTable.day, day),
							sql`${dailyDessertInventoryTable.dessertId} IN (${sql.join(dessertIds, sql`, `)})`,
						),
					)
					.returning({
						dessertId: dailyDessertInventoryTable.dessertId,
						newQuantity: dailyDessertInventoryTable.quantity,
					});

				const updatedIds = new Set(updated.map((u) => u.dessertId));
				for (const dessertId of dessertIds) {
					if (!updatedIds.has(dessertId)) {
						const name = nameByDessertId.get(dessertId) ?? "Unknown";
						throw new Error(`Failed to update inventory for ${name} (unexpected error)`);
					}
				}

				inventoryUpdates = updated.map((u) => ({
					dessertId: u.dessertId,
					newQuantity: u.newQuantity,
					previousQuantity: u.newQuantity + (quantityByDessertId.get(u.dessertId) ?? 0),
				}));
			}

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
			const insertPromises: Promise<unknown>[] = [];

			if (modifierInserts.length > 0) {
				insertPromises.push(tx.insert(orderItemModifiersTable).values(modifierInserts));
			}

			if (inventoryUpdates.length > 0) {
				insertPromises.push(
					tx.insert(inventoryAuditLogTable).values(
						inventoryUpdates.map((update) => ({
							day,
							dessertId: update.dessertId,
							action: "order_deducted" as const,
							previousQuantity: update.previousQuantity,
							newQuantity: update.newQuantity,
							orderId: order.id,
							userId,
							createdAt: now,
						})),
					),
				);
			}

			await Promise.all(insertPromises);

			return order;
		});
	} catch (error) {
		if (isDatabaseUnavailableError(error)) {
			throw new Error("Database is unavailable. Please try again.", {
				cause: error,
			});
		}
		throw error;
	}

	const duration = performance.now() - start;
	console.log(`createCompletedOrder: ${duration}ms`);
	await refreshOrderMutationViews(order.createdAt);
}
