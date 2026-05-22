"use server";

import { performance } from "node:perf_hooks";
import { Effect } from "effect";
import { unstable_cache } from "next/cache";

import { requireSession as requireAuth } from "@/lib/auth/guards";
import {
	getDailyInventoryDay,
	getDailyInventoryDayKey,
	getInventoryForDay,
	upsertInventoryForDayEffect,
} from "@/lib/daily-inventory";
import { upsertInventorySchema } from "@/lib/validation";
import { CacheTag, updateInventoryTagsEffect } from "@/server/effect/cache-tags";
import { runNextAppEffect } from "@/server/effect/next-runtime";

export async function getCachedTodayInventory() {
	const day = getDailyInventoryDay();
	const dayKey = getDailyInventoryDayKey();

	return unstable_cache(() => getInventoryForDay(day), [CacheTag.inventory, dayKey], {
		revalidate: 60 * 60 * 24,
		tags: [CacheTag.inventory],
	})();
}

export async function upsertTodayInventory(updates: Array<{ dessertId: number; quantity: number }>) {
	await requireAuth();

	// Validate input
	const { updates: validatedUpdates } = upsertInventorySchema.parse({
		updates,
	});

	const start = performance.now();
	const day = getDailyInventoryDay();

	await runNextAppEffect(
		Effect.gen(function* () {
			yield* upsertInventoryForDayEffect({ day, updates: validatedUpdates });
			yield* updateInventoryTagsEffect();
		}),
	);

	const duration = performance.now() - start;
	console.log(`upsertTodayInventory: ${duration.toFixed(2)}ms`);
}
