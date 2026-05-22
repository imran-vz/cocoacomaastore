import { Effect, Layer } from "effect";
import { CacheRevalidator } from "@/server/effect/services/cache";
import { Database } from "@/server/effect/services/db";

export const AppLiveLayer = Layer.mergeAll(Database.Live, CacheRevalidator.Live);

export function runAppEffect<A, E>(effect: Effect.Effect<A, E, Database | CacheRevalidator>) {
	return Effect.runPromise(effect.pipe(Effect.provide(AppLiveLayer)));
}
