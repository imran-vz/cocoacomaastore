"use server";

import { performance } from "node:perf_hooks";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { type Dessert, type Order, type OrderItem, ordersTable } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";

function getStartOfDay(date: Date = new Date()) {
	const d = new Date(date);
	return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function getEndOfDay(date: Date = new Date()) {
	const d = new Date(date);
	return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

function getDayKey(day: Date) {
	const y = day.getFullYear();
	const m = String(day.getMonth() + 1).padStart(2, "0");
	const d = String(day.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

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

async function getOrders(date: Date): Promise<GetOrdersReturnType> {
	const start = performance.now();

	const dayStart = getStartOfDay(date);
	const dayEnd = getEndOfDay(date);

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
	console.log(`[admin] getOrders: ${duration}ms`);

	return orders as GetOrdersReturnType;
}

export async function getCachedOrders(dateString?: string) {
	await requireAdmin();

	const date = dateString ? new Date(dateString) : new Date();
	const day = getStartOfDay(date);
	const dayKey = getDayKey(day);

	return unstable_cache(() => getOrders(date), ["admin-orders", dayKey], {
		revalidate: 60 * 60 * 24,
		tags: ["orders"],
	})();
}
