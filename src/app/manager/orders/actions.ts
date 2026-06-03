"use server";

import { requireSession as requireAuth } from "@/lib/auth/guards";
import { isDatabaseUnavailableError } from "@/lib/errors";
import {
	cancelOrderAsNormalPath,
	createCompletedOrder,
	type GetOrdersReturnType,
	getCachedOrders,
	softDeleteOrder,
} from "@/lib/order-lifecycle";
import type { CartLine } from "@/lib/types";
import { cancelOrderSchema, createOrderWithLinesSchema, deleteOrderSchema } from "@/lib/validation";

interface CreateOrderWithLinesData {
	customerName: string;
	lines: CartLine[];
	deliveryCost: string;
}

export { getCachedOrders, type GetOrdersReturnType };

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

export async function deleteOrder(orderId: number) {
	await requireAuth();
	const { orderId: validatedOrderId } = deleteOrderSchema.parse({ orderId });
	await softDeleteOrder(validatedOrderId);
}

export async function cancelOrder(orderId: number, reason?: string) {
	const user = await requireAuth();
	const validated = cancelOrderSchema.parse({ orderId, reason });
	await mapDatabaseUnavailable(() => cancelOrderAsNormalPath(validated.orderId, user.id, validated.reason));
}
