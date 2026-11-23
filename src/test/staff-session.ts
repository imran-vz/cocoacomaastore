import { AsyncLocalStorage } from "node:async_hooks";
import { vi } from "vitest";
import { type Area, roleOf, type StaffUser } from "@/features/access/area";

const SIGNED_IN_AS = "x-test-staff-user";
const requestHeaders = new AsyncLocalStorage<Headers>();

/**
 * Replaces Better Auth's session lookup with one that reads the staff member from the request
 * headers, so the real access guards run. Call before importing the modules under test.
 */
export function mockStaffSessions() {
	vi.doMock("next/headers", () => ({ headers: async () => requestHeaders.getStore() ?? new Headers() }));
	vi.doMock("@/features/access/auth", () => ({
		auth: {
			api: {
				getSession: async ({ headers }: { headers: Headers }) => {
					const signedIn = headers.get(SIGNED_IN_AS);
					if (!signedIn) return null;
					const { area, ...user } = JSON.parse(signedIn) as StaffUser;
					return { session: { id: `session-${user.id}` }, user: { ...user, role: roleOf(area) } };
				},
			},
		},
	}));
}

type Staff = { id: string; area: Area } | null;

/** Runs `request` as one request from `id` signed in to `area`, or signed out for `null`. */
export function asStaff<T>(staff: Staff, request: () => Promise<T>): Promise<T> {
	const headers = new Headers();
	if (staff) {
		const user: StaffUser = { name: staff.id, email: `${staff.id}@example.com`, ...staff };
		headers.set(SIGNED_IN_AS, JSON.stringify(user));
	}
	return requestHeaders.run(headers, request);
}

/** `call`, with each call made as its own request from `staff`. */
export function signedInAs<A extends unknown[], R>(staff: Staff, call: (...args: A) => Promise<R>) {
	return (...args: A): Promise<R> => asStaff(staff, () => call(...args));
}
