import { buildOrdersViewModel, type OrdersViewModel } from "@/components/orders/orders-view-model";
import { formatLocalDateKey } from "@/lib/local-date";
import type { SerializedOrders } from "@/lib/order-lifecycle";
import { summarizeOrderSales } from "@/lib/order-sales-summary";

export type AdminOrdersViewModel = OrdersViewModel & {
	netRevenueLabel: string;
};

export function buildAdminOrdersViewModel(orders: SerializedOrders): AdminOrdersViewModel {
	const { netRevenue } = summarizeOrderSales(orders);

	return {
		...buildOrdersViewModel(orders),
		netRevenueLabel: `₹${netRevenue.toFixed(2)}`,
	};
}

// The order lifecycle only permits cancellation on the current operating day, so the
// action is offered only while the admin is viewing today.
export function canCancelOnSelectedDate(selectedDate: Date, today: Date): boolean {
	return formatLocalDateKey(selectedDate) === formatLocalDateKey(today);
}
