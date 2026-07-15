"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { getCachedOrders as getCachedOrdersCore, serializeOrders } from "@/lib/order-lifecycle";

export async function getCachedOrders() {
	await requireAdmin();
	return serializeOrders(await getCachedOrdersCore());
}
