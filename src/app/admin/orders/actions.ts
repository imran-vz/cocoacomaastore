"use server";

import { requireAdmin } from "@/lib/auth/guards";
import {
	cancelOrderAsNormalPath,
	getCachedOrders as getCachedOrdersCore,
	serializeOrders,
} from "@/lib/order-lifecycle";
import { cancelOrderSchema } from "@/lib/validation";

export async function getCachedOrders() {
	await requireAdmin();
	return serializeOrders(await getCachedOrdersCore());
}

export async function cancelOrder(orderId: number, reason?: string) {
	const admin = await requireAdmin();
	const validated = cancelOrderSchema.parse({ orderId, reason });
	await cancelOrderAsNormalPath(validated.orderId, admin.id, validated.reason);
}
