import { Effect } from "effect";
import { NextCache } from "@/server/effect/services/next-cache";

export function revalidateTagsEffect(tags: readonly string[]) {
	return Effect.gen(function* () {
		const cache = yield* NextCache;
		yield* cache.revalidateTags(tags);
	});
}

export function updateTagsEffect(tags: readonly string[]) {
	return Effect.gen(function* () {
		const cache = yield* NextCache;
		yield* cache.updateTags(tags);
	});
}

export function updateNextCacheEffect({
	tags = [],
	paths = [],
}: {
	readonly tags?: readonly string[];
	readonly paths?: readonly string[];
}) {
	return Effect.gen(function* () {
		const cache = yield* NextCache;
		yield* cache.updateTags(tags);
		yield* cache.revalidatePaths(paths);
	});
}
