"use server";

import { staffAction } from "@/features/access/action";
import { type CreateOrderInput, cancelOrderSchema, createOrderSchema } from "@/features/orders/contract";
import { cancelCompletedOrder, createCompletedOrder } from "@/features/orders/lifecycle";

/** Saves a POS order. Retrying with the same submission id replays the saved order. */
export const createOrder = staffAction(async (user, input: CreateOrderInput) =>
	createCompletedOrder(createOrderSchema.parse(input), user.id),
);

export const cancelOrder = staffAction(async (user, orderId: number, reason?: string) => {
	const validated = cancelOrderSchema.parse({ orderId, reason });
	return cancelCompletedOrder(validated.orderId, user.id, validated.reason);
});
