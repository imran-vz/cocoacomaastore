import { CacheTag } from "@/lib/cache-tags";
import type { DayKey } from "@/lib/shop-calendar";

function inventoryDayTag(day: DayKey) {
	return `${CacheTag.inventory}:${day}`;
}

/**
 * Tags of one shop day's stock, on the server read and the client query alike: the day's tag,
 * and the base tag that Refresh data (`ALL_CACHE_TAGS`) expires.
 */
export function dayInventoryTags(day: DayKey) {
	return [CacheTag.inventory, inventoryDayTag(day)];
}

/** What a change to one shop day's stock refreshes. */
export function stockChangeTags(day: DayKey) {
	return [inventoryDayTag(day)];
}
