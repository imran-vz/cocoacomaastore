import { Effect } from "effect";
import { Database } from "@/server/effect/services/db";

export function runNextAppEffect<A, E>(effect: Effect.Effect<A, E, Database>) {
	return Effect.runPromise(effect.pipe(Effect.provide(Database.Live)));
}
