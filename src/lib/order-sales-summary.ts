import type { SerializedOrderDetails } from "@/lib/order-lifecycle";

type OrderSalesSummaryInput = Pick<SerializedOrderDetails, "status" | "total"> & {
	orderItems: ReadonlyArray<{ quantity: number }>;
};

export function summarizeOrderSales(orders: readonly OrderSalesSummaryInput[]): { itemsSold: number; revenue: number } {
	let itemsSold = 0;
	let revenue = 0;

	for (const order of orders) {
		if (order.status === "cancelled") continue;

		for (const item of order.orderItems) itemsSold += item.quantity;
		revenue += Number(order.total);
	}

	return { itemsSold, revenue };
}
