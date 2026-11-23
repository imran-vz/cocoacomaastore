/**
 * A stand-in for `next/cache` that caches `unstable_cache` reads by key and evicts them by tag, so
 * integration tests can check that a write refreshes the reads that show it (warm read → write →
 * read sees the change) against real Postgres.
 *
 * ```ts
 * const cache = createTaggedCache();
 * vi.doMock("next/cache", () => cache.nextCache);
 * beforeEach(cache.clear);
 * ```
 */
export function createTaggedCache() {
	const entries = new Map<string, { value: unknown; tags: readonly string[] }>();

	function invalidate(tag: string) {
		for (const [key, entry] of entries) {
			if (entry.tags.includes(tag)) entries.delete(key);
		}
	}

	return {
		clear: () => entries.clear(),
		invalidate,
		nextCache: {
			unstable_cache:
				(read: (...args: unknown[]) => Promise<unknown>, keys: string[], options: { tags: readonly string[] }) =>
				async (...args: unknown[]) => {
					const key = JSON.stringify([keys, args]);
					const cached = entries.get(key);
					if (cached) return cached.value;
					const value = await read(...args);
					entries.set(key, { value, tags: options.tags });
					return value;
				},
			updateTag: invalidate,
			revalidateTag: invalidate,
			revalidatePath: () => {},
		},
	};
}
