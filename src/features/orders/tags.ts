import { stockChangeTags } from "@/features/inventory/tags";
import { CacheTag } from "@/lib/cache-tags";
import type { DayKey } from "@/lib/shop-calendar";

function ordersDayTag(day: DayKey) {
	return `${CacheTag.orders}:${day}`;
}

/**
 * Tags of one shop day's orders, on the server read and the client query alike: the day's tag,
 * and the base tag that Refresh data (`ALL_CACHE_TAGS`) expires.
 */
export function dayOrdersTags(day: DayKey) {
	return [CacheTag.orders, ordersDayTag(day)];
}

/** Orders move stock, so an order change refreshes its day's orders and stock. */
export function orderChangeTags(day: DayKey) {
	return [ordersDayTag(day), ...stockChangeTags(day)];
}
