import type { QueryClient } from "@tanstack/react-query";

declare module "@tanstack/react-query" {
	interface Register {
		/** `tags`: the cache tags (`@/lib/cache-tags`) of the server read behind the query. */
		queryMeta: { tags: readonly string[] };
	}
}

/**
 * The client side of a server tag refresh: invalidates every query whose `meta.tags` names one of
 * `tags`. Resolves once the queries on screen have refetched.
 */
export function invalidateTags(queryClient: QueryClient, tags: readonly string[]) {
	return queryClient.invalidateQueries({
		predicate: (query) => query.meta?.tags.some((tag) => tags.includes(tag)) ?? false,
	});
}
