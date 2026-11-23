import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { APP_URL } from "@/lib/app-url";

export const authClient = createAuthClient({
	baseURL: APP_URL,
	plugins: [adminClient()],
});

export const { signIn, signOut } = authClient;

type AuthResponse<T> = { data: T; error: null } | { data: null; error: { status: number; message?: string } };

/** `status` 0: the request never got a response (offline, or the server unreachable). */
export type AuthOutcome<T> = { ok: true; data: T } | { ok: false; status: number; message?: string };

/**
 * Settles a Better Auth client call. The client resolves a refused request to `{ error }` instead
 * of throwing, but rejects when the request gets no response; both become `{ ok: false }`.
 */
export async function authRequest<T>(request: Promise<AuthResponse<T>>): Promise<AuthOutcome<T>> {
	try {
		const { data, error } = await request;
		if (error) return { ok: false, status: error.status, message: error.message };
		return { ok: true, data: data as T };
	} catch (error) {
		console.error("Auth request failed:", error);
		return { ok: false, status: 0 };
	}
}

/**
 * What to tell staff when a Better Auth request fails: no response or too many attempts in the
 * app's words, a refused request (400 bad credentials, 403…) in Better Auth's own words, which are
 * written for people, and `fallback` for anything else.
 */
export function authFailureMessage(outcome: { status: number; message?: string }, fallback: string): string {
	if (outcome.status === 0) return "Can't reach the store. Check the connection and try again.";
	if (outcome.status === 429) return "Too many attempts. Wait a minute and try again.";
	return outcome.status >= 400 && outcome.status < 500 && outcome.message ? outcome.message : fallback;
}
