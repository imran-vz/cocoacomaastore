import { AsyncLocalStorage } from "node:async_hooks";
import { updateTag } from "next/cache";

const refreshedInAction = new AsyncLocalStorage<Set<string>>();

/**
 * Expires `tags` at once, so later reads in this request (and the page the Server Action
 * re-renders) see the write. Next allows `updateTag` only inside a Server Action and throws
 * anywhere else. Inside `recordRefreshedTags`, the tags are also recorded for the client.
 */
export function updateTags(tags: readonly string[]) {
	const refreshed = refreshedInAction.getStore();
	for (const tag of tags) {
		updateTag(tag);
		refreshed?.add(tag);
	}
}

/** Runs `run` (a Server Action's body), adding every tag it expires with `updateTags` to `refreshed`. */
export function recordRefreshedTags<A>(refreshed: Set<string>, run: () => Promise<A>): Promise<A> {
	return refreshedInAction.run(refreshed, run);
}
