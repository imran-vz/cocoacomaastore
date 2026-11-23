import { type QueryKey, queryOptions, skipToken } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetch-json";
import type { ServerSnapshot } from "@/lib/server-snapshot";

function snapshotData<T>(snapshot: ServerSnapshot<T>): T {
	return snapshot.data;
}

/**
 * Options of a client query of one of the app's snapshot routes (`snapshotRoute`): cached as the
 * snapshot, selecting its data, and carrying the cache `tags` of the server read behind it. A
 * `null` URL holds the query until there is something to read.
 */
export function snapshotQuery<T, TKey extends QueryKey = QueryKey>(
	url: string | null,
	{ tags, ...options }: { queryKey: TKey; tags: readonly string[]; staleTime?: number; gcTime?: number },
) {
	return queryOptions<ServerSnapshot<T>, Error, T, TKey>({
		...options,
		queryFn: url === null ? skipToken : ({ signal }) => fetchJson<ServerSnapshot<T>>(url, signal),
		select: snapshotData<T>,
		meta: { tags },
	});
}
