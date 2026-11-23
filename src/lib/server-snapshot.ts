/**
 * Data a server read returned, and when (server clock). Pages pass one to a client query to start
 * from, and API routes answer with one (`snapshotRoute`), so a query can tell which of two copies
 * is newer by comparing server read times only (see `useSeededQuery`).
 */
export type ServerSnapshot<T> = { readonly data: T; readonly readAt: number };

export async function snapshot<T>(read: Promise<T>): Promise<ServerSnapshot<T>> {
	const data = await read;
	return { data, readAt: Date.now() };
}
