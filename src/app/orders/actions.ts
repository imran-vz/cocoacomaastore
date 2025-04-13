"use server";

import { asc, desc, eq, gte } from "drizzle-orm";

import { db } from "@/db";
import { orderItemsTable, ordersTable } from "@/db/schema";
import type { CartItem } from "@/lib/types";

interface CreateOrderData {
	customerName: string;
	items: CartItem[];
	deliveryCost: string;
}

export async function getOrders() {
	const startOfDay = new Date();
	startOfDay.setHours(0, 0, 0, 0);

	const orders = await db.query.ordersTable.findMany({
		columns: {
			isDeleted: false,
		},
		where: gte(ordersTable.createdAt, startOfDay),
		orderBy: [desc(ordersTable.status), asc(ordersTable.createdAt)],
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

	return orders;
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
				total: data.items
					.reduce(
						(acc, item) => acc + item.quantity * item.price,
						Number.parseFloat(data.deliveryCost),
					)
					.toFixed(2),
				deliveryCost: data.deliveryCost,
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
	await db
		.update(ordersTable)
		.set({ isDeleted: true })
		.where(eq(ordersTable.id, orderId));
}
