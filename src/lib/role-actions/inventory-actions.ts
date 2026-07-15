import { performance } from "node:perf_hooks";
import { Effect } from "effect";
import {
	getDailyInventoryDay,
	type InventoryUpdate,
	type InventoryWriteResult,
	setInventoryWithAuditEffect,
} from "@/lib/daily-inventory";
import { upsertInventorySchema } from "@/lib/validation";
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
		async upsertInventoryWithAudit(updates: InventoryUpdate[]): Promise<InventoryWriteResult> {
			const start = performance.now();
			const user = await requireUser();
			const { updates: validatedUpdates } = upsertInventorySchema.parse({ updates });
			const day = getDailyInventoryDay();

			const result = await runNextAppEffect(
				Effect.gen(function* () {
					const writeResult = yield* setInventoryWithAuditEffect({ day, updates: validatedUpdates, userId: user.id });
					if (writeResult.ok) yield* updateInventoryTagsEffect();
					return writeResult;
				}),
			);

			const duration = performance.now() - start;
			console.log(`[${label}] upsertInventoryWithAudit: ${duration.toFixed(2)}ms`);
			return result;
		},
	};
}
