import { performance } from "node:perf_hooks";
import { Effect } from "effect";
import { getDailyInventoryDay, setInventoryWithAuditEffect } from "@/lib/daily-inventory";
import { updateInventoryTagsEffect } from "@/server/effect/cache-tags";
import { runNextAppEffect } from "@/server/effect/next-runtime";

type RoleActionUser = {
	id: string;
};

type RoleActionConfig = {
	label: string;
	requireUser: () => Promise<RoleActionUser>;
};

export function createInventoryActions({ label, requireUser }: RoleActionConfig) {
	return {
		async upsertInventoryWithAudit(updates: Array<{ dessertId: number; quantity: number }>) {
			const start = performance.now();
			const day = getDailyInventoryDay();

			if (updates.length === 0) return;

			const user = await requireUser();

			await runNextAppEffect(
				Effect.gen(function* () {
					yield* setInventoryWithAuditEffect({ day, updates, userId: user.id });
					yield* updateInventoryTagsEffect();
				}),
			);

			const duration = performance.now() - start;
			console.log(`[${label}] upsertInventoryWithAudit: ${duration.toFixed(2)}ms`);
		},
	};
}
