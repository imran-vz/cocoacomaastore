import { ZodError } from "zod";
import type { StaffUser } from "@/features/access/area";
import { requireAdmin, requireStaff } from "@/features/access/session";
import type { ActionResult } from "@/lib/action-result";
import { userFacingMessage } from "@/lib/errors";
import { recordRefreshedTags } from "@/server/next-cache";

function guardedAction<A extends unknown[], R>(
	requireUser: () => Promise<StaffUser>,
	run: (user: StaffUser, ...args: A) => Promise<R>,
) {
	return async (...args: A): Promise<ActionResult<R>> => {
		const refreshed = new Set<string>();
		const reporting = (result: ActionResult<R>): ActionResult<R> =>
			refreshed.size > 0 ? { ...result, refreshed: [...refreshed] } : result;
		try {
			const user = await requireUser();
			return reporting({ ok: true, data: await recordRefreshedTags(refreshed, () => run(user, ...args)) });
		} catch (error) {
			if (error instanceof ZodError) {
				return reporting({ ok: false, error: error.issues[0]?.message ?? "Invalid input" });
			}
			const message = userFacingMessage(error);
			if (message !== undefined) return reporting({ ok: false, error: message });
			throw error;
		}
	};
}

/**
 * A server action any signed-in staff member may call. Export the result from a "use server"
 * file. Its result names the cache tags it refreshed (`updateTags`), for the client to refresh too.
 */
export function staffAction<A extends unknown[], R>(run: (user: StaffUser, ...args: A) => Promise<R>) {
	return guardedAction(requireStaff, run);
}

/** A server action only admins may call; see `staffAction`. */
export function adminAction<A extends unknown[], R>(run: (user: StaffUser, ...args: A) => Promise<R>) {
	return guardedAction(requireAdmin, run);
}
