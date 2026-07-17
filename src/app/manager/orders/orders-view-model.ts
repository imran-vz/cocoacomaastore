import { buildOrdersViewModel, type OrdersViewModel } from "@/components/orders/orders-view-model";
import type { SerializedOrders } from "@/lib/order-lifecycle";

export type ManagerOrdersViewModel = OrdersViewModel & {
	todayLabel: string;
};

export function buildManagerOrdersViewModel(orders: SerializedOrders, todayLabel: string): ManagerOrdersViewModel {
	return { ...buildOrdersViewModel(orders), todayLabel };
}
