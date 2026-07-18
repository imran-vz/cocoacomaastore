"use server";

import { unstable_cache } from "next/cache";

import { getEnabledCombos } from "@/lib/combo-service";
import { CacheTag } from "@/server/effect/cache-tags";

/**
 * Cached, enabled-only combos with details for the public UI.
 */
export const getCachedCombos = unstable_cache(getEnabledCombos, [CacheTag.combos], {
	revalidate: 60 * 60 * 24,
	tags: [CacheTag.combos],
});
