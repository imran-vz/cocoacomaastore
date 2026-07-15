"use server";

import { getCachedOrders as getCachedOrdersCore, serializeOrders } from "@/lib/order-lifecycle";

export async function getCachedOrders() {
	return serializeOrders(await getCachedOrdersCore());
}
