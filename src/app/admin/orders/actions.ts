"use server";

import { performance } from "node:perf_hooks";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import {
	type Dessert,
	type Order,
	type OrderItem,
	ordersTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";

async function requireAdmin() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.session || !session?.user) {
		throw new Error("Unauthorized");
	}
	if (session.user.role !== "admin") {
		throw new Error("Admin access required");
	}
	return session.user;
}

function getStartOfDay(date: Date = new Date()) {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

function getEndOfDay(date: Date = new Date()) {
	const d = new Date(date);
	d.setHours(23, 59, 59, 999);
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

	return orders;
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
