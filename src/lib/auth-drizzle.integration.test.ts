import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { accountTable, userTable } from "@/db/schema";
import { closeIntegrationDatabase, integrationDb, resetIntegrationData } from "@/test/integration/database";

const baseURL = "http://localhost:3000";
let requestHeaders = new Headers();

vi.stubEnv("BETTER_AUTH_SECRET", "test-only-auth-drizzle-secret-0001");
vi.stubEnv("BETTER_AUTH_BASE_URL", baseURL);
vi.stubEnv("NEXT_PUBLIC_APP_URL", baseURL);
vi.doMock("@/db", () => ({ db: integrationDb }));
vi.doMock("next/headers", () => ({ headers: async () => requestHeaders }));
vi.doMock("@/server/effect/next-runtime", () => ({
	runNextAppEffect: async () => undefined,
}));

const { auth } = await import("@/lib/auth");
const { createManager } = await import("@/app/admin/settings/managers/actions");

function authRequest(path: string, body?: Record<string, unknown>, cookie?: string) {
	const headers = new Headers({ origin: baseURL });
	if (body) headers.set("content-type", "application/json");
	if (cookie) headers.set("cookie", cookie);

	return new Request(`${baseURL}/api/auth${path}`, {
		method: body ? "POST" : "GET",
		headers,
		body: body ? JSON.stringify(body) : undefined,
	});
}

function responseCookie(headers: Headers) {
	const cookie = headers
		.getSetCookie()
		.map((value) => value.split(";", 1)[0])
		.join("; ");
	expect(cookie).not.toBe("");
	return cookie;
}

async function seedCredentialUser({
	id,
	email,
	password,
	role,
}: {
	id: string;
	email: string;
	password: string;
	role: "admin" | "user";
}) {
	await integrationDb.insert(userTable).values({
		id,
		name: "Seeded Manager",
		email,
		role,
	});
	await integrationDb.insert(accountTable).values({
		id: `${id}-credential`,
		accountId: id,
		providerId: "credential",
		userId: id,
		password: await bcrypt.hash(password, 12),
	});
}

async function signIn(email: string, password: string) {
	const response = await auth.handler(authRequest("/sign-in/email", { email, password }));
	expect(response.status).toBe(200);
	return responseCookie(response.headers);
}

describe("Better Auth Drizzle policy", () => {
	beforeEach(async () => {
		requestHeaders = new Headers();
		await resetIntegrationData();
	});

	afterAll(async () => {
		await closeIntegrationDatabase();
	});

	it("disables public signup while seeded credentials can sign in and resolve their session", async () => {
		const signup = await auth.handler(
			authRequest("/sign-up/email", {
				name: "Public Signup",
				email: "public@example.com",
				password: "public-password-123",
			}),
		);
		expect(signup.status).toBe(400);
		expect(await integrationDb.select().from(userTable)).toHaveLength(0);

		await seedCredentialUser({
			id: "seeded-user",
			email: "seeded@example.com",
			password: "seeded-password-123",
			role: "admin",
		});
		const cookie = await signIn("seeded@example.com", "seeded-password-123");
		const session = await auth.handler(authRequest("/get-session", undefined, cookie));

		expect(session.status).toBe(200);
		expect(await session.json()).toMatchObject({
			user: { id: "seeded-user", email: "seeded@example.com", role: "admin" },
		});
	});

	it("provisions supported roles through the guarded action while direct destructive APIs stay forbidden", async () => {
		await seedCredentialUser({
			id: "seeded-admin",
			email: "admin@example.com",
			password: "admin-password-123",
			role: "admin",
		});
		const cookie = await signIn("admin@example.com", "admin-password-123");
		requestHeaders = new Headers({ cookie });

		await expect(
			createManager({
				name: "Created Administrator",
				email: "created-admin@example.com",
				password: "created-password-123",
				role: "admin",
			}),
		).resolves.toEqual({ success: true });
		await expect(
			createManager({
				name: "Created User",
				email: "created-user@example.com",
				password: "created-password-123",
				role: "user",
			}),
		).resolves.toEqual({ success: true });

		const created = await integrationDb
			.select({ email: userTable.email, role: userTable.role })
			.from(userTable)
			.where(eq(userTable.name, "Created Administrator"));
		expect(created).toEqual([{ email: "created-admin@example.com", role: "admin" }]);
		const [target] = await integrationDb
			.select({ id: userTable.id, role: userTable.role })
			.from(userTable)
			.where(eq(userTable.email, "created-user@example.com"));
		expect(target).toBeDefined();

		const remove = await auth.handler(authRequest("/admin/remove-user", { userId: target?.id }, cookie));
		expect(remove.status).toBe(403);
		const setRole = await auth.handler(authRequest("/admin/set-role", { userId: target?.id, role: "admin" }, cookie));
		expect(setRole.status).toBe(403);

		expect(
			await integrationDb
				.select({ role: userTable.role })
				.from(userTable)
				.where(eq(userTable.id, target?.id ?? "missing")),
		).toEqual([{ role: "user" }]);
	});
});
