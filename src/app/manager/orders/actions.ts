"use server";

import { requireSession as requireAuth, requireManagerAccess } from "@/lib/auth/guards";
import { isDatabaseUnavailableError } from "@/lib/errors";
import {
	cancelOrderAsNormalPath,
	createCompletedOrder,
	getCachedOrders as getCachedOrdersCore,
	serializeOrders,
} from "@/lib/order-lifecycle";
import type { CartLine } from "@/lib/types";
import { cancelOrderSchema, createOrderWithLinesSchema } from "@/lib/validation";

interface CreateOrderWithLinesData {
	customerName: string;
	lines: CartLine[];
	deliveryCost: string;
}

export async function getCachedOrders() {
	await requireManagerAccess();
	return serializeOrders(await getCachedOrdersCore());
}

async function mapDatabaseUnavailable<T>(fn: () => Promise<T>): Promise<T> {
	try {
		return await fn();
	} catch (error) {
		if (isDatabaseUnavailableError(error)) {
			throw new Error("Database is unavailable. Please try again.", { cause: error });
		}
		throw error;
	}
}

/**
 * Creates an order from cart lines (supports modifiers).
 * - Aggregates inventory deduction by base dessert
 * - Inserts order_items with unitPrice
 * - Persists order_item_modifiers
 */
export async function createOrderWithLines(data: CreateOrderWithLinesData) {
	const user = await mapDatabaseUnavailable(() => requireAuth());
	const validated = createOrderWithLinesSchema.parse(data);
	await mapDatabaseUnavailable(() => createCompletedOrder(validated, user.id));
}

export async function cancelOrder(orderId: number, reason?: string) {
	const user = await requireAuth();
	const validated = cancelOrderSchema.parse({ orderId, reason });
	await mapDatabaseUnavailable(() => cancelOrderAsNormalPath(validated.orderId, user.id, validated.reason));
}
