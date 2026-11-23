import { dayInventoryTags } from "@/features/inventory/tags";
import { dayOrdersTags } from "@/features/orders/tags";
import { CacheTag } from "@/lib/cache-tags";
import type { DayKey } from "@/lib/shop-calendar";

/**
 * A day not yet closed: its report reads today's figures live from the orders, since today is not
 * compiled until it closes. Every other day comes from the compiled rows.
 */
export function isLiveDay(day: DayKey, today: DayKey) {
	return day >= today;
}

/** Tags of Insights › Day for `day`, on the server read and the client query alike. */
export function dayReportTags(day: DayKey, today: DayKey) {
	return [
		CacheTag.analytics,
		CacheTag.desserts,
		...dayInventoryTags(day),
		...(isLiveDay(day, today) ? dayOrdersTags(today) : []),
	];
}

/** Tags of reads made only of compiled analytics: the monthly trend and a month's Business Weeks. */
export const COMPILED_TAGS = [CacheTag.analytics];

/** Tags of a month's dessert sales, which show dessert names. */
export const DESSERT_SALES_TAGS = [CacheTag.analytics, CacheTag.desserts];
