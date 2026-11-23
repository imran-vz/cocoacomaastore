import type { DayOrders } from "@/features/orders/contract";
import { dayOrdersTags } from "@/features/orders/tags";
import type { DayKey } from "@/lib/shop-calendar";
import { snapshotQuery } from "@/lib/snapshot-query";

/**
 * One shop day's orders. The Orders page and Insights' sales by hour share this cache entry.
 * Served by src/app/api/orders/route.ts.
 */
export function dayOrdersQuery(day: DayKey) {
	return snapshotQuery<DayOrders>(`/api/orders?date=${day}`, { queryKey: ["orders", day], tags: dayOrdersTags(day) });
}
