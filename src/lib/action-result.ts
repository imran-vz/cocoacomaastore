import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { invalidateTags } from "@/lib/query-tags";

/**
 * What every server action returns: its value, or a message staff can act on. Unexpected failures
 * still throw. `refreshed`: the cache tags the action expired on the server, which the client
 * refreshes in its queries too (`useRunAction`).
 */
export type ActionResult<T = void> = ({ ok: true; data: T } | { ok: false; error: string }) & {
	refreshed?: readonly string[];
};

export const ACTION_FAILED = "Something went wrong. Try again.";

type RunActionOptions = {
	/** The error when the action throws instead of answering (a lost connection, an unexpected server error). */
	fallback?: string;
	/**
	 * `wait` (default): resolve once the queries on screen that show what the action changed have
	 * refetched. `background`: resolve at once and let them refetch behind.
	 */
	refetch?: "wait" | "background";
};

/**
 * Awaits a server action from the client. An action that throws instead of answering becomes
 * `{ ok: false, error: fallback }`, so callers handle one failure shape; the client queries
 * carrying the tags the action refreshed on the server are refreshed as well.
 */
export async function runAction<T>(
	queryClient: QueryClient,
	action: Promise<ActionResult<T>>,
	{ fallback = ACTION_FAILED, refetch = "wait" }: RunActionOptions = {},
): Promise<ActionResult<T>> {
	let result: ActionResult<T>;
	try {
		result = await action;
	} catch (error) {
		console.error(error);
		return { ok: false, error: fallback };
	}
	if (result.refreshed && result.refreshed.length > 0) {
		const refetching = invalidateTags(queryClient, result.refreshed);
		if (refetch === "wait") await refetching;
	}
	return result;
}

export type RunAction = <T>(action: Promise<ActionResult<T>>, options?: RunActionOptions) => Promise<ActionResult<T>>;

/** `runAction` with the app's query client. */
export function useRunAction(): RunAction {
	const queryClient = useQueryClient();
	return useCallback<RunAction>((action, options) => runAction(queryClient, action, options), [queryClient]);
}
