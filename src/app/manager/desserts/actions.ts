"use server";

import { performance } from "node:perf_hooks";
import { Effect } from "effect";
import { requireSession } from "@/lib/auth/guards";
import { getDailyInventoryDay, setInventoryWithAuditEffect } from "@/lib/daily-inventory";
import { updateInventoryTagsEffect } from "@/server/effect/cache-tags";
import { runNextAppEffect } from "@/server/effect/next-runtime";

// Manager-specific action for inventory management
export async function upsertInventoryWithAudit(updates: Array<{ dessertId: number; quantity: number }>) {
	const start = performance.now();
	const day = getDailyInventoryDay();

	if (updates.length === 0) return;

	const user = await requireSession();
	const userId = user.id;

	await runNextAppEffect(
		Effect.gen(function* () {
			yield* setInventoryWithAuditEffect({ day, updates, userId });
			yield* updateInventoryTagsEffect();
		}),
	);

	const duration = performance.now() - start;
	console.log(`upsertInventoryWithAudit: ${duration.toFixed(2)}ms`);
}
