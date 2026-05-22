"use server";

import { requireSession as requireAuth } from "@/lib/auth/guards";
import { isDatabaseUnavailableError } from "@/lib/errors";
import { createCompletedOrder } from "@/lib/order-intake";
import {
	cancelOrderAsNormalPath,
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

/**
 * Creates an order from cart lines (supports modifiers).
 * - Aggregates inventory deduction by base dessert
 * - Inserts order_items with unitPrice
 * - Persists order_item_modifiers
 */
export async function createOrderWithLines(data: CreateOrderWithLinesData) {
	let user: Awaited<ReturnType<typeof requireAuth>>;
	try {
		user = await requireAuth();
	} catch (error) {
		if (isDatabaseUnavailableError(error)) {
			throw new Error("Database is unavailable. Please try again.", {
				cause: error,
			});
		}
		throw error;
	}

	const validated = createOrderWithLinesSchema.parse(data);
	try {
		await createCompletedOrder(validated, user.id);
	} catch (error) {
		if (isDatabaseUnavailableError(error)) {
			throw new Error("Database is unavailable. Please try again.", {
				cause: error,
			});
		}
		throw error;
	}
}

export async function deleteOrder(orderId: number) {
	await requireAuth();
	const { orderId: validatedOrderId } = deleteOrderSchema.parse({ orderId });
	await softDeleteOrder(validatedOrderId);
}

export async function cancelOrder(orderId: number, reason?: string) {
	const user = await requireAuth();
	const validated = cancelOrderSchema.parse({ orderId, reason });
	try {
		await cancelOrderAsNormalPath(validated.orderId, user.id, validated.reason);
	} catch (error) {
		if (isDatabaseUnavailableError(error)) {
			throw new Error("Database is unavailable. Please try again.", {
				cause: error,
			});
		}
		throw error;
	}
}
