"use server";

import { db } from "@/db";
import { dessertsTable, ordersTable, orderItemsTable } from "@/db/schema";
import type { CartItem, Dessert, Order } from "@/lib/types";
import { asc, desc, eq, gt } from "drizzle-orm";

export async function getDesserts() {
	return await db.select().from(dessertsTable).orderBy(dessertsTable.id);
}

export async function createDessert(data: Omit<Dessert, "id">) {
	await db.insert(dessertsTable).values({
		name: data.name,
		description: data.description,
		price: data.price,
	});
}

export async function updateDessert(id: number, data: Omit<Dessert, "id">) {
	await db
		.update(dessertsTable)
		.set({
			name: data.name,
			description: data.description,
			price: data.price,
		})
		.where(eq(dessertsTable.id, id));
}

export async function deleteDessert(id: number) {
	await db.delete(dessertsTable).where(eq(dessertsTable.id, id));
}

interface CreateOrderData {
	customerName: string;
	items: CartItem[];
}

async function _getOrders() {
	const yesterday = new Date();
	yesterday.setDate(yesterday.getDate() - 1);

	const orders = await db
		.select()
		.from(ordersTable)
		.where(gt(ordersTable.createdAt, yesterday))
		.innerJoin(orderItemsTable, eq(ordersTable.id, orderItemsTable.orderId))
		.innerJoin(dessertsTable, eq(orderItemsTable.dessertId, dessertsTable.id))
		.orderBy(desc(ordersTable.status), asc(ordersTable.createdAt));
	return orders;
}
export async function getOrders() {
	const orders = await _getOrders();
	return groupOrders(orders);
}

function groupOrders(orders: Awaited<ReturnType<typeof _getOrders>>) {
	const result = new Map<number, Order>();
	for (const order of orders) {
		if (result.has(order.orders.id)) {
			continue;
		}

		result.set(order.orders.id, {
			id: order.orders.id,
			customerName: order.orders.customerName,
			status: order.orders.status,
			createdAt: order.orders.createdAt,
			items: orders
				.filter((o) => o.orders.id === order.orders.id)
				.map((item) => ({
					id: item.desserts.id,
					name: item.desserts.name,
					description: item.desserts.description,
					price: item.desserts.price,
					quantity: item.order_items.quantity,
				})),
		});
	}

	return Array.from(result.values());
}

export async function createOrder(data: CreateOrderData) {
	console.log(data);

	await db.transaction(async (tx) => {
		// Create the order
		const [order] = await tx
			.insert(ordersTable)
			.values({
				customerName: data.customerName,
				createdAt: new Date(),
				status: "pending",
				total: data.items.reduce(
					(acc, item) => acc + item.quantity * item.price,
					0,
				),
			})
			.returning();

		// Create order items
		await tx.insert(orderItemsTable).values(
			data.items.map((item) => ({
				orderId: order.id,
				dessertId: item.id,
				quantity: item.quantity,
			})),
		);

		return order;
	});
}

export async function updateOrderStatus(
	orderId: number,
	status: "pending" | "completed",
) {
	await db
		.update(ordersTable)
		.set({ status })
		.where(eq(ordersTable.id, orderId));
}

export async function deleteOrder(orderId: number) {
	return await db.transaction(async (tx) => {
		// Delete order items first
		await tx
			.delete(orderItemsTable)
			.where(eq(orderItemsTable.orderId, orderId));

		// Then delete the order
		await tx.delete(ordersTable).where(eq(ordersTable.id, orderId));
	});
}
