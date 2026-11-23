import { NextResponse } from "next/server";
import type { StaffUser } from "@/features/access/area";
import { AccessError, requireAdmin, requireStaff } from "@/features/access/session";
import { snapshot } from "@/lib/server-snapshot";

type Handler = (request: Request, user: StaffUser) => Promise<Response>;

/** Access failures, from the guard or from a guarded read inside the handler, become 401/403 responses. */
function guardedRoute(requireUser: () => Promise<StaffUser>, handler: Handler) {
	return async (request: Request) => {
		try {
			return await handler(request, await requireUser());
		} catch (error) {
			if (error instanceof AccessError) {
				return NextResponse.json(
					{ error: error.status === 401 ? "Unauthorized" : "Forbidden" },
					{ status: error.status },
				);
			}
			throw error;
		}
	};
}

export function staffRoute(handler: Handler) {
	return guardedRoute(requireStaff, handler);
}

export function adminRoute(handler: Handler) {
	return guardedRoute(requireAdmin, handler);
}

type GuardedRoute = typeof staffRoute;

/**
 * A GET route answering one guarded read as a `ServerSnapshot`. With `key`, the read takes the
 * value of `?<param>=`, and a missing or invalid one is answered 400.
 */
export function snapshotRoute(guard: GuardedRoute, read: () => Promise<unknown>): ReturnType<GuardedRoute>;
export function snapshotRoute<Key>(
	guard: GuardedRoute,
	read: (key: Key) => Promise<unknown>,
	key: { param: string; parse: (value: string | null) => Key | null },
): ReturnType<GuardedRoute>;
export function snapshotRoute<Key>(
	guard: GuardedRoute,
	read: (key?: Key) => Promise<unknown>,
	key?: { param: string; parse: (value: string | null) => Key | null },
) {
	return guard(async (request) => {
		if (!key) return NextResponse.json(await snapshot(read()));
		const value = key.parse(new URL(request.url).searchParams.get(key.param));
		if (value === null) return NextResponse.json({ error: `Invalid ${key.param}` }, { status: 400 });
		return NextResponse.json(await snapshot(read(value)));
	});
}
