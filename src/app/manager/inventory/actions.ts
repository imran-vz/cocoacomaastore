"use server";

import { unstable_cache } from "next/cache";

import { requireManagerAccess } from "@/lib/auth/guards";
import { getDailyInventoryDay, getDailyInventoryDayKey, getInventoryForDay } from "@/lib/daily-inventory";
import { upsertInventoryWithAudit as upsertManagerInventoryWithAudit } from "@/lib/role-actions/manager-inventory";
import { CacheTag } from "@/server/effect/cache-tags";

export async function getCachedTodayInventory() {
	await requireManagerAccess();
	const day = getDailyInventoryDay();
	const dayKey = getDailyInventoryDayKey();

	return unstable_cache(() => getInventoryForDay(day), [CacheTag.inventory, dayKey], {
		revalidate: 60 * 60 * 24,
		tags: [CacheTag.inventory],
	})();
}

export async function upsertTodayInventory(updates: Parameters<typeof upsertManagerInventoryWithAudit>[0]) {
	return upsertManagerInventoryWithAudit(updates);
}
