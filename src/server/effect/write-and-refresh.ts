import { Effect } from "effect";
import type { AppDatabase } from "@/db";
import { runNextAppEffect } from "@/server/effect/next-runtime";
import { Database } from "@/server/effect/services/db";
import { updateTags } from "@/server/next-cache";

/**
 * Runs one database write, then expires the tags of the reads that show it (fixed, or chosen from
 * the write's result) so they are fresh in this request and after. Server Actions only; the
 * action's result names the tags, so the client refreshes them too (`staffAction`).
 */
export async function writeAndRefresh<A>(
	operation: string,
	tags: readonly string[] | ((result: A) => readonly string[]),
	run: (db: AppDatabase) => Promise<A>,
): Promise<A> {
	const result = await runNextAppEffect(
		Effect.gen(function* () {
			const database = yield* Database;
			return yield* database.attempt(operation, run);
		}),
	);
	updateTags(typeof tags === "function" ? tags(result) : tags);
	return result;
}
