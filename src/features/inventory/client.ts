import type { DayInventory } from "@/features/inventory/shapes";
import { dayInventoryTags } from "@/features/inventory/tags";
import type { DayKey } from "@/lib/shop-calendar";
import { snapshotQuery } from "@/lib/snapshot-query";

/**
 * The stock of the shop's current day, as the server reckons it; `day` is the day it last answered
 * for. Served by src/app/api/inventory/today/route.ts.
 */
export function todayInventoryQuery(day: DayKey) {
	return snapshotQuery<DayInventory>("/api/inventory/today", {
		queryKey: ["inventory", "today"],
		tags: dayInventoryTags(day),
		// Every till sells from the same stock, so counts go stale sooner than other screens.
		staleTime: 30_000,
	});
}
