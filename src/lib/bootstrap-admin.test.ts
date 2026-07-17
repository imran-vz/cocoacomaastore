import { describe, expect, it, vi } from "vitest";
import {
	type BootstrapAdminConfig,
	type BootstrapAdminDependencies,
	bootstrapFirstAdmin,
	type LockedBootstrapAdminDependencies,
	parseBootstrapAdminEnvironment,
	SHARED_DATABASE_ACKNOWLEDGEMENT,
} from "@/lib/bootstrap-admin";

const sentinelConfig: BootstrapAdminConfig = {
	name: "Bootstrap Operator",
	email: "sentinel-email@example.invalid",
	password: "sentinel-password-123",
	databaseUrl: "postgresql://sentinel-user:sentinel-secret@localhost:5432/sentinel_database",
};

function environment(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
	return {
		NODE_ENV: "test",
		BOOTSTRAP_ADMIN_NAME: "  Bootstrap Operator  ",
		BOOTSTRAP_ADMIN_EMAIL: "  ADMIN@EXAMPLE.INVALID  ",
		BOOTSTRAP_ADMIN_PASSWORD: "sentinel-password-123",
		DATABASE_URL: "postgresql://localhost:5432/bootstrap_test",
		...overrides,
	};
}

function dependencies(overrides: Partial<LockedBootstrapAdminDependencies> = {}) {
	const lockedDependencies = {
		findUserByEmail: vi.fn(async () => null),
		findFirstAdmin: vi.fn(async () => null),
		createCredentialUser: vi.fn(async () => ({ id: "sentinel-created-id" })),
		promoteCreatedUser: vi.fn(async () => true),
		deleteCreatedUser: vi.fn(async () => true),
		...overrides,
	};
	return {
		...lockedDependencies,
		withFirstAdminLock: vi.fn((run) => run(lockedDependencies)),
	} satisfies BootstrapAdminDependencies & LockedBootstrapAdminDependencies;
}

const sensitiveSentinels = [
	sentinelConfig.password,
	sentinelConfig.databaseUrl,
	sentinelConfig.email,
	"sentinel-created-id",
	"sentinel-raw-dependency-error",
];

async function expectSafeRejection(run: () => Promise<unknown>) {
	let surfaced: unknown;
	try {
		await run();
	} catch (error) {
		surfaced = error;
	}
	expect(surfaced).toBeInstanceOf(Error);
	const message = (surfaced as Error).message;
	for (const sentinel of sensitiveSentinels) expect(message).not.toContain(sentinel);
	return message;
}

describe("parseBootstrapAdminEnvironment", () => {
	it("normalizes bootstrap inputs for every supported loopback hostname without acknowledgement", () => {
		for (const databaseUrl of [
			"postgres://localhost:5432/bootstrap_test",
			"postgresql://127.0.0.1:5432/bootstrap_test",
			"postgresql://[::1]:5432/bootstrap_test",
		]) {
			expect(parseBootstrapAdminEnvironment(environment({ DATABASE_URL: databaseUrl }))).toEqual({
				name: "Bootstrap Operator",
				email: "admin@example.invalid",
				password: "sentinel-password-123",
				databaseUrl,
			});
		}
	});

	it("requires the exact one-purpose acknowledgement for a remote PostgreSQL database", () => {
		const remoteUrl = "postgresql://sentinel-user:sentinel-secret@remote.example.invalid/bootstrap";
		for (const acknowledgement of [undefined, "create_first_admin", `${SHARED_DATABASE_ACKNOWLEDGEMENT} `]) {
			expect(() =>
				parseBootstrapAdminEnvironment(
					environment({
						DATABASE_URL: remoteUrl,
						COCOACOMAA_BOOTSTRAP_ADMIN_ACKNOWLEDGE_SHARED_DATABASE: acknowledgement,
					}),
				),
			).toThrow("Shared database bootstrap requires the exact acknowledgement");
		}

		expect(
			parseBootstrapAdminEnvironment(
				environment({
					DATABASE_URL: remoteUrl,
					COCOACOMAA_BOOTSTRAP_ADMIN_ACKNOWLEDGE_SHARED_DATABASE: SHARED_DATABASE_ACKNOWLEDGEMENT,
				}),
			),
		).toMatchObject({ databaseUrl: remoteUrl });
	});

	it("rejects missing and invalid fields without exposing password or database URL input", () => {
		const sentinelUrl = "https://sentinel-user:sentinel-secret@remote.example.invalid/bootstrap";
		const cases: Array<{ overrides: Partial<NodeJS.ProcessEnv>; variable: string }> = [
			{ overrides: { BOOTSTRAP_ADMIN_NAME: undefined }, variable: "BOOTSTRAP_ADMIN_NAME" },
			{ overrides: { BOOTSTRAP_ADMIN_NAME: "   " }, variable: "BOOTSTRAP_ADMIN_NAME" },
			{ overrides: { BOOTSTRAP_ADMIN_EMAIL: undefined }, variable: "BOOTSTRAP_ADMIN_EMAIL" },
			{ overrides: { BOOTSTRAP_ADMIN_EMAIL: "invalid-email" }, variable: "BOOTSTRAP_ADMIN_EMAIL" },
			{ overrides: { BOOTSTRAP_ADMIN_PASSWORD: undefined }, variable: "BOOTSTRAP_ADMIN_PASSWORD" },
			{ overrides: { BOOTSTRAP_ADMIN_PASSWORD: "short" }, variable: "BOOTSTRAP_ADMIN_PASSWORD" },
			{ overrides: { DATABASE_URL: sentinelUrl }, variable: "DATABASE_URL" },
			{ overrides: { DATABASE_URL: "sentinel-not-a-url" }, variable: "DATABASE_URL" },
		];

		for (const { overrides, variable } of cases) {
			let message = "";
			try {
				parseBootstrapAdminEnvironment(environment(overrides));
			} catch (error) {
				message = (error as Error).message;
			}
			expect(message).toContain(variable);
			expect(message).not.toContain("sentinel-password-123");
			expect(message).not.toContain(sentinelUrl);
		}
	});
});

describe("bootstrapFirstAdmin", () => {
	it("returns already-admin for the requested existing administrator without writing", async () => {
		const deps = dependencies({
			findUserByEmail: vi.fn(async () => ({ id: "existing-admin", role: "admin" })),
		});

		await expect(bootstrapFirstAdmin(sentinelConfig, deps)).resolves.toBe("already-admin");
		expect(deps.findFirstAdmin).not.toHaveBeenCalled();
		expect(deps.createCredentialUser).not.toHaveBeenCalled();
		expect(deps.promoteCreatedUser).not.toHaveBeenCalled();
		expect(deps.deleteCreatedUser).not.toHaveBeenCalled();
	});

	it("refuses when a different first administrator exists", async () => {
		const deps = dependencies({ findFirstAdmin: vi.fn(async () => ({ id: "different-admin" })) });

		await expectSafeRejection(() => bootstrapFirstAdmin(sentinelConfig, deps));
		expect(deps.createCredentialUser).not.toHaveBeenCalled();
		expect(deps.promoteCreatedUser).not.toHaveBeenCalled();
	});

	it("refuses to promote an existing non-administrator account", async () => {
		const deps = dependencies({
			findUserByEmail: vi.fn(async () => ({ id: "existing-user", role: "user" })),
		});

		await expectSafeRejection(() => bootstrapFirstAdmin(sentinelConfig, deps));
		expect(deps.findFirstAdmin).not.toHaveBeenCalled();
		expect(deps.createCredentialUser).not.toHaveBeenCalled();
	});

	it("creates one credential user and promotes exactly the returned identity", async () => {
		const deps = dependencies();

		await expect(bootstrapFirstAdmin(sentinelConfig, deps)).resolves.toBe("created");
		expect(deps.createCredentialUser).toHaveBeenCalledTimes(1);
		expect(deps.createCredentialUser).toHaveBeenCalledWith({
			name: sentinelConfig.name,
			email: sentinelConfig.email,
			password: sentinelConfig.password,
			role: "user",
		});
		expect(deps.promoteCreatedUser).toHaveBeenCalledWith({
			id: "sentinel-created-id",
			email: sentinelConfig.email,
		});
		expect(deps.deleteCreatedUser).not.toHaveBeenCalled();
	});

	it("contains promotion and creation failures while cleaning up only a known created identity", async () => {
		for (const promoteResult of [false, new Error("sentinel-raw-dependency-error")]) {
			const deps = dependencies({
				promoteCreatedUser:
					promoteResult instanceof Error
						? vi.fn(async () => {
								throw promoteResult;
							})
						: vi.fn(async () => promoteResult),
			});
			await expectSafeRejection(() => bootstrapFirstAdmin(sentinelConfig, deps));
			expect(deps.deleteCreatedUser).toHaveBeenCalledOnce();
			expect(deps.deleteCreatedUser).toHaveBeenCalledWith("sentinel-created-id");
		}

		for (const cleanupResult of [false, new Error("sentinel-raw-dependency-error")]) {
			const deps = dependencies({
				promoteCreatedUser: vi.fn(async () => false),
				deleteCreatedUser:
					cleanupResult instanceof Error
						? vi.fn(async () => {
								throw cleanupResult;
							})
						: vi.fn(async () => cleanupResult),
			});
			const message = await expectSafeRejection(() => bootstrapFirstAdmin(sentinelConfig, deps));
			expect(message).toContain("manual auth-table review");
			expect(deps.deleteCreatedUser).toHaveBeenCalledWith("sentinel-created-id");
		}

		const createFailure = dependencies({
			createCredentialUser: vi.fn(async () => {
				throw new Error("sentinel-raw-dependency-error");
			}),
		});
		const message = await expectSafeRejection(() => bootstrapFirstAdmin(sentinelConfig, createFailure));
		expect(message).toContain("manual auth-table review");
		expect(createFailure.deleteCreatedUser).not.toHaveBeenCalled();
	});
});
