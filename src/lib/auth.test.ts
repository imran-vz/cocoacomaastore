import type { BetterAuthOptions } from "better-auth";
import { describe, expect, it, vi } from "vitest";

const { betterAuth, capturedOptions } = vi.hoisted(() => {
	const capturedOptions: Pick<BetterAuthOptions, "emailAndPassword"> = {};

	return {
		capturedOptions,
		betterAuth: vi.fn((options) => {
			Object.assign(capturedOptions, options);
			return { options, api: { getSession: vi.fn() } };
		}),
	};
});

vi.mock("better-auth", () => ({ betterAuth }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/db/schema", () => ({
	accountTable: {},
	sessionTable: {},
	userTable: {},
	verificationTable: {},
}));
vi.mock("better-auth/adapters/drizzle", () => ({
	drizzleAdapter: vi.fn(() => ({})),
}));
vi.mock("better-auth/plugins", () => ({
	admin: vi.fn(() => ({})),
}));

const { auth } = await import("@/lib/auth");

describe("auth configuration", () => {
	it("keeps email sign-in enabled while disabling public email signup", () => {
		expect(auth.options.emailAndPassword.enabled).toBe(true);
		expect(auth.options.emailAndPassword.disableSignUp).toBe(true);
	});

	it("rejects the public sign-up endpoint", async () => {
		const { betterAuth: createAuth } = await vi.importActual<typeof import("better-auth")>("better-auth");
		const isolatedAuth = createAuth({
			secret: "test-only-secret-at-least-32-characters-long",
			baseURL: "http://localhost:3000",
			emailAndPassword: capturedOptions.emailAndPassword,
		});

		const response = await isolatedAuth.handler(
			new Request("http://localhost:3000/api/auth/sign-up/email", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "http://localhost:3000",
				},
				body: JSON.stringify({
					name: "Test User",
					email: "test@example.com",
					password: "test-password",
				}),
			}),
		);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			code: "EMAIL_PASSWORD_SIGN_UP_DISABLED",
		});
	});
});
