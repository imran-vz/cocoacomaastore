import { parseMoneyCents } from "@/lib/money";
import type { SerializedOrderDetails } from "@/lib/order-lifecycle";

type OrderSalesSummaryInput = Pick<SerializedOrderDetails, "deliveryCost" | "status" | "total"> & {
	orderItems: ReadonlyArray<{ quantity: number }>;
};

export function summarizeOrderSales(orders: readonly OrderSalesSummaryInput[]): {
	itemsSold: number;
	netRevenue: number;
} {
	let itemsSold = 0;
	let netRevenueCents = 0;

	for (const order of orders) {
		if (order.status === "cancelled") continue;

		for (const item of order.orderItems) itemsSold += item.quantity;
		netRevenueCents += parseMoneyCents(order.total) - parseMoneyCents(order.deliveryCost);
	}

	return { itemsSold, netRevenue: netRevenueCents / 100 };
}
