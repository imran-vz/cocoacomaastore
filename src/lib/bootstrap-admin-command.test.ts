import { afterEach, describe, expect, it, vi } from "vitest";
import type { BootstrapAdminDependencies } from "@/lib/bootstrap-admin";
import { runBootstrapAdminCommand } from "../../scripts/seed-admin";

function invokingEnvironment(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
	return {
		...overrides,
		NODE_ENV: overrides.NODE_ENV ?? "test",
		BOOTSTRAP_ADMIN_NAME: "Bootstrap Operator",
		BOOTSTRAP_ADMIN_EMAIL: "admin@example.invalid",
		BOOTSTRAP_ADMIN_PASSWORD: "sentinel-password-123",
	};
}

function successfulDependencies(): BootstrapAdminDependencies {
	return {
		withFirstAdminLock: async (run) =>
			run({
				findUserByEmail: async () => null,
				findFirstAdmin: async () => null,
				createCredentialUser: async () => ({ id: "created-user" }),
				promoteCreatedUser: async () => true,
				deleteCreatedUser: async () => true,
			}),
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("administrator bootstrap command", () => {
	it("loads persistent configuration from .env and deletes one-time values before runtime imports", async () => {
		const environment = invokingEnvironment();
		const loadDependencies = vi.fn(async () => {
			expect(environment).toMatchObject({
				DATABASE_URL: "postgresql://localhost:5432/bootstrap_test",
				BETTER_AUTH_SECRET: "persistent-secret",
				BETTER_AUTH_BASE_URL: "http://localhost:3000",
				NEXT_PUBLIC_APP_URL: "http://localhost:3000",
				DB_QUERY_TIMING: "0",
			});
			expect(environment.BOOTSTRAP_ADMIN_NAME).toBeUndefined();
			expect(environment.BOOTSTRAP_ADMIN_EMAIL).toBeUndefined();
			expect(environment.BOOTSTRAP_ADMIN_PASSWORD).toBeUndefined();
			expect(environment.COCOACOMAA_BOOTSTRAP_ADMIN_ACKNOWLEDGE_SHARED_DATABASE).toBeUndefined();
			return successfulDependencies();
		});
		vi.spyOn(console, "log").mockImplementation(() => undefined);

		await expect(
			runBootstrapAdminCommand({
				environment,
				readEnvironmentFile: async () => `
DATABASE_URL=postgresql://localhost:5432/bootstrap_test
BETTER_AUTH_SECRET=persistent-secret
BETTER_AUTH_BASE_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
`,
				loadDependencies,
			}),
		).resolves.toBe(0);
		expect(loadDependencies).toHaveBeenCalledOnce();
	});

	it("gives the invoking persistent environment precedence over .env", async () => {
		const environment = invokingEnvironment({ DATABASE_URL: "postgresql://localhost:5432/invoking_database" });
		vi.spyOn(console, "log").mockImplementation(() => undefined);

		await expect(
			runBootstrapAdminCommand({
				environment,
				readEnvironmentFile: async () => "DATABASE_URL=postgresql://localhost:5432/file_database",
				loadDependencies: async () => successfulDependencies(),
			}),
		).resolves.toBe(0);
		expect(environment.DATABASE_URL).toBe("postgresql://localhost:5432/invoking_database");
	});

	it("ignores one-time bootstrap values persisted in .env", async () => {
		const environment: NodeJS.ProcessEnv = { NODE_ENV: "test" };
		const loadDependencies = vi.fn(async () => successfulDependencies());
		vi.spyOn(console, "error").mockImplementation(() => undefined);

		await expect(
			runBootstrapAdminCommand({
				environment,
				readEnvironmentFile: async () => `
DATABASE_URL=postgresql://localhost:5432/bootstrap_test
BOOTSTRAP_ADMIN_NAME=Persisted Operator
BOOTSTRAP_ADMIN_EMAIL=persisted@example.invalid
BOOTSTRAP_ADMIN_PASSWORD=persisted-password
`,
				loadDependencies,
			}),
		).resolves.toBe(1);
		expect(loadDependencies).not.toHaveBeenCalled();
		expect(console.error).toHaveBeenCalledWith("First administrator bootstrap failed.");
	});

	it("does not expose configuration or dependency failures", async () => {
		const environment = invokingEnvironment({
			DATABASE_URL: "postgresql://sentinel-user:sentinel-secret@localhost/db",
		});
		vi.spyOn(console, "error").mockImplementation(() => undefined);

		await expect(
			runBootstrapAdminCommand({
				environment,
				readEnvironmentFile: async () => undefined,
				loadDependencies: async () => {
					throw new Error("sentinel-raw-dependency-error");
				},
			}),
		).resolves.toBe(1);
		const output = JSON.stringify(vi.mocked(console.error).mock.calls);
		for (const sentinel of ["sentinel-secret", "sentinel-password-123", "sentinel-raw-dependency-error"]) {
			expect(output).not.toContain(sentinel);
		}
	});
});
