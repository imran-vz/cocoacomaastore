import { betterAuth } from "better-auth";
import { admin, testUtils } from "better-auth/plugins";
import { describe, expect, it } from "vitest";
import { adminPluginOptions } from "@/lib/auth/admin-access";

const baseURL = "http://localhost:3000";

function createTestAuth() {
	return betterAuth({
		baseURL,
		secret: "test-only-admin-access-secret-0001",
		plugins: [admin(adminPluginOptions), testUtils()],
	});
}

function post(path: string, headers: Headers, body: Record<string, unknown>) {
	const requestHeaders = new Headers(headers);
	requestHeaders.set("content-type", "application/json");
	requestHeaders.set("origin", baseURL);

	return new Request(`${baseURL}/api/auth${path}`, {
		method: "POST",
		headers: requestHeaders,
		body: JSON.stringify(body),
	});
}

async function createAdminSession(auth: ReturnType<typeof createTestAuth>, id: string) {
	const context = await auth.$context;
	const adminUser = context.test.createUser({
		id,
		email: `${id}@example.com`,
		name: "Test Administrator",
		role: "admin",
	});
	await context.test.saveUser(adminUser);
	const { headers } = await context.test.login({ userId: adminUser.id });
	return { context, headers };
}

describe("application Admin access policy", () => {
	it("allows trusted server code to provision both supported roles", async () => {
		const auth = createTestAuth();

		for (const role of ["admin", "user"] as const) {
			const result = await auth.api.createUser({
				body: {
					email: `created-${role}@example.com`,
					name: `Created ${role}`,
					password: "test-password-123",
					role,
				},
			});

			expect(result.user.role).toBe(role);
		}
	});

	it("forbids direct user removal and preserves the target", async () => {
		const auth = createTestAuth();
		const { context, headers } = await createAdminSession(auth, "admin-remove");
		const target = context.test.createUser({ id: "remove-target", role: "user" });
		await context.test.saveUser(target);

		const response = await auth.handler(post("/admin/remove-user", headers, { userId: target.id }));

		expect(response.status).toBe(403);
		expect(await context.internalAdapter.findUserById(target.id)).not.toBeNull();
	});

	it("forbids direct role changes and preserves the target role", async () => {
		const auth = createTestAuth();
		const { context, headers } = await createAdminSession(auth, "admin-set-role");
		const target = context.test.createUser({ id: "role-target", role: "user" });
		await context.test.saveUser(target);

		const response = await auth.handler(
			post("/admin/set-role", headers, {
				userId: target.id,
				role: "admin",
			}),
		);

		expect(response.status).toBe(403);
		expect(((await context.internalAdapter.findUserById(target.id)) as { role?: string } | null)?.role).toBe("user");
	});

	it("forbids role changes through updates while preserving ordinary updates", async () => {
		const auth = createTestAuth();
		const { context, headers } = await createAdminSession(auth, "admin-update");
		const target = context.test.createUser({ id: "update-target", name: "Original Name", role: "user" });
		await context.test.saveUser(target);

		const roleResponse = await auth.handler(
			post("/admin/update-user", headers, {
				userId: target.id,
				data: { role: "admin" },
			}),
		);
		expect(roleResponse.status).toBe(403);
		expect(((await context.internalAdapter.findUserById(target.id)) as { role?: string } | null)?.role).toBe("user");

		const updateResponse = await auth.handler(
			post("/admin/update-user", headers, {
				userId: target.id,
				data: { name: "Updated Name" },
			}),
		);
		expect(updateResponse.status).toBe(200);
		expect((await context.internalAdapter.findUserById(target.id))?.name).toBe("Updated Name");
	});
});
