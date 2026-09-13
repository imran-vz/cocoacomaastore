import { Effect } from "effect";
import {
	getDailyInventoryDay,
	type InventoryUpdate,
	type InventoryWriteResult,
	setInventoryWithAuditEffect,
} from "@/lib/daily-inventory";
import { getDayKey } from "@/lib/ist-date";
import { upsertInventorySchema } from "@/lib/validation";
import { updateInventoryTagsEffect } from "@/server/effect/cache-tags";
import { runNextAppEffect } from "@/server/effect/next-runtime";

type RoleActionUser = {
	id: string;
};

type RoleActionConfig = {
	requireUser: () => Promise<RoleActionUser>;
};

export function createInventoryActions({ requireUser }: RoleActionConfig) {
	return {
		async upsertInventoryWithAudit(updates: InventoryUpdate[]): Promise<InventoryWriteResult> {
			const user = await requireUser();
			const { updates: validatedUpdates } = upsertInventorySchema.parse({ updates });
			const day = getDailyInventoryDay();

			return runNextAppEffect(
				Effect.gen(function* () {
					const writeResult = yield* setInventoryWithAuditEffect({ day, updates: validatedUpdates, userId: user.id });
					if (writeResult.ok) yield* updateInventoryTagsEffect(getDayKey(day));
					return writeResult;
				}),
			);
		},
	};
}
