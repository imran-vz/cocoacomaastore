import { type Area, homeOf } from "@/features/access/area";
import { canBrowsePastDays } from "@/features/orders/contract";
import type { DayKey } from "@/lib/shop-calendar";

/** The Orders page's search params: the day it opens on, and an order to open and scroll to. */
export const ORDERS_DATE_PARAM = "date";
export const ORDER_ID_PARAM = "orderId";

/** The Orders page opened on `orderId`, placed on shop day `day`. */
export function orderHref(area: Area, day: DayKey, orderId: number): string {
	const params = new URLSearchParams();
	if (canBrowsePastDays(area)) params.set(ORDERS_DATE_PARAM, day);
	params.set(ORDER_ID_PARAM, String(orderId));
	return `${homeOf(area)}/orders?${params}`;
}
