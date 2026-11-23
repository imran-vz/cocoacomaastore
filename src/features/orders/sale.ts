import type { Order } from "@/db/schema";

export type OrderStatus = Order["status"];

/**
 * The statuses an order is stored with. The POS saves orders `completed`; cancelling one makes it
 * `cancelled`. `pending` is allowed by the schema but nothing writes it.
 */
export const ORDER_STATUS = {
	pending: "pending",
	completed: "completed",
	cancelled: "cancelled",
} as const satisfies { [Status in OrderStatus]: Status };

/**
 * Only completed orders are sales: they count towards revenue and items sold everywhere.
 * Deleted orders are never sales either; reads leave them out before this rule applies.
 */
export const SALE_STATUS = ORDER_STATUS.completed;

export function isSale(order: { status: string }): boolean {
	return order.status === SALE_STATUS;
}
