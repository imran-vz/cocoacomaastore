"use server";

import { getCachedOrders as getCachedOrdersCore } from "@/lib/order-lifecycle";

export async function getCachedOrders() {
	return getCachedOrdersCore();
}
