"use server";

import { performance } from "node:perf_hooks";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { revalidateTag, unstable_cache } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import {
	type Dessert,
	dailyDessertInventoryTable,
	inventoryAuditLogTable,
	type Order,
	type OrderItem,
	orderItemsTable,
	ordersTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { sanitizeCustomerName } from "@/lib/sanitize";
import type { CartItem } from "@/lib/types";
import { createOrderSchema, deleteOrderSchema } from "@/lib/validation";

interface CreateOrderData {
	customerName: string;
	items: CartItem[];
	deliveryCost: string;
}

async function requireAuth() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.session || !session?.user) {
		throw new Error("Unauthorized");
	}
	return session.user;
}

function getStartOfDay(date: Date = new Date()) {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

function getDayKey(day: Date) {
	const y = day.getFullYear();
	const m = String(day.getMonth() + 1).padStart(2, "0");
	const d = String(day.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

type OrderItemWithDessert = Omit<OrderItem, "dessertId" | "orderId"> & {
	dessert: Pick<Dessert, "id" | "name">;
};

export type GetOrdersReturnType = (Omit<Order, "isDeleted"> & {
	orderItems: OrderItemWithDessert[];
})[];

async function getOrders(day: Date): Promise<GetOrdersReturnType> {
	const start = performance.now();
	const orders = await db.query.ordersTable.findMany({
		columns: {
			isDeleted: false,
		},
		where: and(
			eq(ordersTable.isDeleted, false),
			gte(ordersTable.createdAt, day),
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

	return orders;
}

export async function getCachedOrders() {
	const day = getStartOfDay();
	const dayKey = getDayKey(day);

	return unstable_cache(() => getOrders(day), ["orders", dayKey], {
		revalidate: 60 * 60 * 24,
		tags: ["orders"],
	})();
}

export async function createOrder(data: CreateOrderData) {
	const user = await requireAuth();

	// Validate and sanitize input
	const validated = createOrderSchema.parse(data);
	const sanitizedCustomerName = sanitizeCustomerName(validated.customerName);

	const start = performance.now();
	const day = new Date();
	day.setHours(0, 0, 0, 0);
	const now = new Date();

	// Filter out items with unlimited stock - they don't need inventory deduction
	const itemsNeedingInventory = validated.items.filter(
		(item) => !item.hasUnlimitedStock,
	);

	await db.transaction(async (tx) => {
		const dessertIds = itemsNeedingInventory.map((item) => item.id);
		const quantityByDessertId = new Map(
			itemsNeedingInventory.map((item) => [item.id, item.quantity]),
		);

		let inventoryUpdates: {
			dessertId: number;
			previousQuantity: number;
			newQuantity: number;
		}[] = [];

		// Atomic inventory deduction with row-level locking
		if (itemsNeedingInventory.length > 0) {
			// STEP 1: Lock inventory rows with SELECT FOR UPDATE
			// This prevents concurrent transactions from reading/modifying these rows
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

			// Build map of current stock levels
			const stockMap = new Map(
				lockedInventory.map((row) => [row.dessertId, row.quantity]),
			);

			// STEP 2: Validate stock levels while rows are locked
			// This check is now atomic - no other transaction can modify stock
			for (const item of itemsNeedingInventory) {
				const currentStock = stockMap.get(item.id) ?? 0;
				if (currentStock < item.quantity) {
					throw new Error(
						`Insufficient stock for ${item.name}. Available: ${currentStock}, Requested: ${item.quantity}`,
					);
				}
			}

			// STEP 3: Perform atomic update with CASE WHEN
			// Rows are still locked, so this update is guaranteed to succeed
			const caseStatements = itemsNeedingInventory
				.map(
					(item) =>
						sql`WHEN ${dailyDessertInventoryTable.dessertId} = ${item.id} THEN ${dailyDessertInventoryTable.quantity} - ${item.quantity}`,
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

			// Verify all updates succeeded (should always pass after lock validation)
			const updatedIds = new Set(updated.map((u) => u.dessertId));
			for (const item of itemsNeedingInventory) {
				if (!updatedIds.has(item.id)) {
					throw new Error(
						`Failed to update inventory for ${item.name} (unexpected error)`,
					);
				}
			}

			// Calculate previous quantities from new quantities + ordered amounts
			inventoryUpdates = updated.map((u) => ({
				dessertId: u.dessertId,
				newQuantity: u.newQuantity,
				previousQuantity:
					u.newQuantity + (quantityByDessertId.get(u.dessertId) ?? 0),
			}));
		}

		// Create the order
		const [order] = await tx
			.insert(ordersTable)
			.values({
				customerName: sanitizedCustomerName,
				createdAt: now,
				status: "completed",
				total: validated.items
					.reduce(
						(acc, item) => acc + item.quantity * item.price,
						Number.parseFloat(validated.deliveryCost),
					)
					.toFixed(2),
				deliveryCost: validated.deliveryCost,
			})
			.returning();

		// Bulk insert order items and audit log in parallel
		const insertPromises: Promise<unknown>[] = [
			tx.insert(orderItemsTable).values(
				validated.items.map((item) => ({
					orderId: order.id,
					dessertId: item.id,
					quantity: item.quantity,
				})),
			),
		];

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
						userId: user.id,
						createdAt: now,
					})),
				),
			);
		}

		await Promise.all(insertPromises);

		return order;
	});
	const duration = performance.now() - start;
	console.log(`createOrder: ${duration}ms`);
	revalidateTag("orders", "max");
	revalidateTag("inventory", "max");
}

export async function deleteOrder(orderId: number) {
	await requireAuth();

	// Validate input
	const { orderId: validatedOrderId } = deleteOrderSchema.parse({ orderId });

	const start = performance.now();
	await db
		.update(ordersTable)
		.set({ isDeleted: true })
		.where(eq(ordersTable.id, validatedOrderId));
	const duration = performance.now() - start;
	console.log(`deleteOrder: ${duration}ms`);
	revalidateTag("orders", "max");
}
