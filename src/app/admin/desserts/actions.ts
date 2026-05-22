"use server";

import { performance } from "node:perf_hooks";
import { Effect } from "effect";
import { requireAdmin } from "@/lib/auth/guards";
import { getDailyInventoryDay, setInventoryWithAuditEffect } from "@/lib/daily-inventory";
import { updateTagsEffect } from "@/server/effect/cache-tags";
import { runNextAppEffect } from "@/server/effect/next-runtime";

export async function upsertInventoryWithAudit(updates: Array<{ dessertId: number; quantity: number }>) {
	const start = performance.now();
	const day = getDailyInventoryDay();

	if (updates.length === 0) return;

	const user = await requireAdmin();

	await runNextAppEffect(
		Effect.gen(function* () {
			yield* setInventoryWithAuditEffect({ day, updates, userId: user.id });
			yield* updateTagsEffect(["inventory"]);
		}),
	);

	const duration = performance.now() - start;
	console.log(`[admin] upsertInventoryWithAudit: ${duration.toFixed(2)}ms`);
}
