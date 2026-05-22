import { Effect, Layer } from "effect";
import { AppLiveLayer } from "@/server/effect/runtime";
import type { CacheRevalidator } from "@/server/effect/services/cache";
import type { Database } from "@/server/effect/services/db";
import { NextCache } from "@/server/effect/services/next-cache";

const NextAppLiveLayer = Layer.mergeAll(AppLiveLayer, NextCache.Live);

export function runNextAppEffect<A, E>(effect: Effect.Effect<A, E, Database | CacheRevalidator | NextCache>) {
	return Effect.runPromise(effect.pipe(Effect.provide(NextAppLiveLayer)));
}
