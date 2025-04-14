"use server";

import { asc, desc, eq, gte } from "drizzle-orm";
import { revalidateTag, unstable_cache } from "next/cache";

import { db } from "@/db";
import { orderItemsTable, ordersTable } from "@/db/schema";
import type { CartItem } from "@/lib/types";
import { performance } from "node:perf_hooks";

interface CreateOrderData {
	customerName: string;
	items: CartItem[];
	deliveryCost: string;
}

async function getOrders() {
	const startOfDay = new Date();
	startOfDay.setHours(0, 0, 0, 0);
	const start = performance.now();
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
	const duration = performance.now() - start;
	console.log(`getOrders: ${duration}ms`);

	return orders;
}

export const getCachedOrders = unstable_cache(getOrders, ["orders"], {
	revalidate: 60 * 60 * 24,
	tags: ["orders"],
});

export async function createOrder(data: CreateOrderData) {
	const start = performance.now();

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
	const duration = performance.now() - start;
	console.log(`createOrder: ${duration}ms`);
	revalidateTag("orders");
}

export async function updateOrderStatus(
	orderId: number,
	status: "pending" | "completed",
) {
	const start = performance.now();
	await db
		.update(ordersTable)
		.set({ status })
		.where(eq(ordersTable.id, orderId));
	const duration = performance.now() - start;
	console.log(`updateOrderStatus: ${duration}ms`);
	revalidateTag("orders");
}

export async function deleteOrder(orderId: number) {
	const start = performance.now();
	await db
		.update(ordersTable)
		.set({ isDeleted: true })
		.where(eq(ordersTable.id, orderId));
	const duration = performance.now() - start;
	console.log(`deleteOrder: ${duration}ms`);
	revalidateTag("orders");
}
