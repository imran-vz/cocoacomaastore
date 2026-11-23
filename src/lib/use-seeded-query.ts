import {
	type DefinedUseQueryResult,
	hashKey,
	type QueryClient,
	type QueryKey,
	type UseQueryOptions,
	type UseQueryResult,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import type { ServerSnapshot } from "@/lib/server-snapshot";

/** Puts the server's copy in the cache when the server read it after the cached copy was read. */
export function seedFromServer<T>(queryClient: QueryClient, queryKey: QueryKey, snapshot: ServerSnapshot<T>) {
	const cached = queryClient.getQueryData<ServerSnapshot<T>>(queryKey);
	if (cached && cached.readAt < snapshot.readAt) queryClient.setQueryData(queryKey, snapshot);
}

type SnapshotQueryOptions<T, TData, TKey extends QueryKey> = UseQueryOptions<ServerSnapshot<T>, Error, TData, TKey>;

/**
 * `useQuery` for a query cached as server snapshots, starting from what the server rendered. The
 * query cache outlives client navigation and `initialData` is ignored once a key is cached, so a
 * page could otherwise show an older cached copy than the one it was rendered with: the copy the
 * server read last wins.
 */
export function useSeededQuery<T, TData, TKey extends QueryKey>(
	options: SnapshotQueryOptions<T, TData, TKey>,
	snapshot: ServerSnapshot<T>,
): DefinedUseQueryResult<TData, Error>;
export function useSeededQuery<T, TData, TKey extends QueryKey>(
	options: SnapshotQueryOptions<T, TData, TKey>,
	snapshot: ServerSnapshot<T> | undefined,
): UseQueryResult<TData, Error>;
export function useSeededQuery<T, TData, TKey extends QueryKey>(
	options: SnapshotQueryOptions<T, TData, TKey>,
	snapshot: ServerSnapshot<T> | undefined,
): UseQueryResult<TData, Error> {
	const queryClient = useQueryClient();
	// Callers build query options per render, so the key is compared by its hash.
	const queryHash = hashKey(options.queryKey);

	useEffect(() => {
		const query = queryClient.getQueryCache().get(queryHash);
		if (snapshot && query) seedFromServer(queryClient, query.queryKey, snapshot);
	}, [queryClient, queryHash, snapshot]);

	return useQuery(snapshot ? { ...options, initialData: snapshot, initialDataUpdatedAt: snapshot.readAt } : options);
}
