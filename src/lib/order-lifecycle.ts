import { performance } from "node:perf_hooks";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/db";
import {
	type Dessert,
	dailyDessertInventoryTable,
	dessertsTable,
	inventoryAuditLogTable,
	type Order,
	type OrderItem,
	orderItemsTable,
	ordersTable,
} from "@/db/schema";
import { isDatabaseUnavailableError } from "@/lib/errors";
import { getAnalyticsDay, getDayKey, getEndOfDayIST, getStartOfDayIST } from "@/lib/ist-date";
import { refreshOrderMutationViews } from "@/lib/order-intake";
import { CacheTag, OrderTags, updateTagsEffect } from "@/server/effect/cache-tags";
import { runNextAppEffect } from "@/server/effect/next-runtime";

type OrderItemModifierWithDessert = {
	id: number;
	quantity: number;
	dessert: Pick<Dessert, "id" | "name">;
};

type OrderItemWithDessert = Omit<OrderItem, "dessertId" | "orderId"> & {
	dessert: Pick<Dessert, "id" | "name">;
	modifiers: OrderItemModifierWithDessert[];
};

export type GetOrdersReturnType = (Omit<Order, "isDeleted"> & {
	orderItems: OrderItemWithDessert[];
})[];

export async function getOrders(date?: Date): Promise<GetOrdersReturnType> {
	const start = performance.now();
	const dayStart = getStartOfDayIST(date);
	const dayEnd = getEndOfDayIST(date);

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

export async function softDeleteOrder(orderId: number) {
	const start = performance.now();
	const [order] = await db
		.update(ordersTable)
		.set({ isDeleted: true })
		.where(eq(ordersTable.id, orderId))
		.returning({ createdAt: ordersTable.createdAt });
	const duration = performance.now() - start;
	console.log(`deleteOrder: ${duration}ms`);
	if (order) {
		await refreshOrderMutationViews(order.createdAt, OrderTags.delete);
		return;
	}
	await runNextAppEffect(updateTagsEffect(OrderTags.delete));
}

export async function cancelOrderAsNormalPath(orderId: number, userId: string, reason?: string) {
	const start = performance.now();
	const day = getAnalyticsDay();
	const now = new Date();
	let order: Pick<Order, "id" | "status" | "isDeleted" | "createdAt">;

	try {
		order = await db.transaction(async (tx) => {
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

			const dessertMap = new Map(desserts.map((dessert) => [dessert.id, dessert]));
			const quantityToRestore = new Map<number, number>();
			for (const item of orderItems) {
				const dessert = dessertMap.get(item.dessertId);
				if (dessert && !dessert.hasUnlimitedStock) {
					const current = quantityToRestore.get(item.dessertId) ?? 0;
					quantityToRestore.set(item.dessertId, current + item.quantity);
				}
			}

			const orderDay = getAnalyticsDay(order.createdAt);
			const isToday = orderDay.getTime() === day.getTime();

			let inventoryUpdates: {
				dessertId: number;
				previousQuantity: number;
				newQuantity: number;
			}[] = [];

			if (quantityToRestore.size > 0 && isToday) {
				const dessertIdsToRestore = Array.from(quantityToRestore.keys());

				await tx
					.select({
						dessertId: dailyDessertInventoryTable.dessertId,
						quantity: dailyDessertInventoryTable.quantity,
					})
					.from(dailyDessertInventoryTable)
					.where(
						and(
							eq(dailyDessertInventoryTable.day, day),
							inArray(dailyDessertInventoryTable.dessertId, dessertIdsToRestore),
						),
					)
					.for("update");

				const caseStatements = dessertIdsToRestore
					.map((dessertId) => {
						const restoreQty = quantityToRestore.get(dessertId) ?? 0;
						return sql`WHEN ${dailyDessertInventoryTable.dessertId} = ${dessertId} THEN ${dailyDessertInventoryTable.quantity} + ${restoreQty}`;
					})
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
							inArray(dailyDessertInventoryTable.dessertId, dessertIdsToRestore),
						),
					)
					.returning({
						dessertId: dailyDessertInventoryTable.dessertId,
						newQuantity: dailyDessertInventoryTable.quantity,
					});

				inventoryUpdates = updated.map((u) => ({
					dessertId: u.dessertId,
					newQuantity: u.newQuantity,
					previousQuantity: u.newQuantity - (quantityToRestore.get(u.dessertId) ?? 0),
				}));
			}

			await tx.update(ordersTable).set({ status: "cancelled" }).where(eq(ordersTable.id, orderId));

			if (inventoryUpdates.length > 0) {
				const auditNote = reason ? `Order cancelled: ${reason}` : "Order cancelled - stock restored";

				await tx.insert(inventoryAuditLogTable).values(
					inventoryUpdates.map((update) => ({
						day,
						dessertId: update.dessertId,
						action: "order_cancelled" as const,
						previousQuantity: update.previousQuantity,
						newQuantity: update.newQuantity,
						orderId,
						userId,
						note: auditNote,
						createdAt: now,
					})),
				);
			}

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

	await refreshOrderMutationViews(order.createdAt);

	const duration = performance.now() - start;
	console.log(`cancelOrder: ${duration}ms`);
}
