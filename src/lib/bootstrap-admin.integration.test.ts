import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { accountTable, userTable } from "@/db/schema";
import { bootstrapFirstAdmin } from "@/lib/bootstrap-admin";
import { closeIntegrationDatabase, integrationDb, resetIntegrationData } from "@/test/integration/database";

const baseURL = "http://localhost:3000";

vi.stubEnv("BETTER_AUTH_SECRET", "test-only-bootstrap-secret-0001");
vi.stubEnv("BETTER_AUTH_BASE_URL", baseURL);
vi.stubEnv("NEXT_PUBLIC_APP_URL", baseURL);
vi.doMock("@/db", () => ({ db: integrationDb }));

const [{ auth }, { createBootstrapAdminDependencies }] = await Promise.all([
	import("@/lib/auth"),
	import("@/lib/bootstrap-admin-database"),
]);
const dependencies = createBootstrapAdminDependencies(integrationDb, auth);

describe("first administrator bootstrap concurrency", () => {
	beforeEach(async () => {
		await resetIntegrationData();
	});

	afterAll(async () => {
		await closeIntegrationDatabase();
	});

	it("serializes different-email attempts so exactly one administrator is created", async () => {
		const attempts = await Promise.allSettled([
			bootstrapFirstAdmin(
				{
					name: "First Bootstrap",
					email: "first-bootstrap@example.invalid",
					password: "first-bootstrap-password",
					databaseUrl: "postgresql://localhost/cocoacomaa_test",
				},
				dependencies,
			),
			bootstrapFirstAdmin(
				{
					name: "Second Bootstrap",
					email: "second-bootstrap@example.invalid",
					password: "second-bootstrap-password",
					databaseUrl: "postgresql://localhost/cocoacomaa_test",
				},
				dependencies,
			),
		]);

		expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
		expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
		const [administrator] = await integrationDb.select().from(userTable);
		expect(administrator.role).toBe("admin");
		expect(["first-bootstrap@example.invalid", "second-bootstrap@example.invalid"]).toContain(administrator.email);
		expect(await integrationDb.select().from(userTable)).toHaveLength(1);
		expect(await integrationDb.select().from(accountTable)).toHaveLength(1);
	});
});
