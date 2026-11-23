"use server";

import { staffAction } from "@/features/access/action";
import { ALL_CACHE_TAGS } from "@/lib/cache-tags";
import { updateTags } from "@/server/next-cache";

/** Drops every cached read, for when staff suspect the screens are showing stale data. */
export const refreshAllData = staffAction(async () => {
	updateTags(ALL_CACHE_TAGS);
});
