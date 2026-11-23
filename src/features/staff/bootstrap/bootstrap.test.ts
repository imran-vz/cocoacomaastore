import { describe, expect, it, vi } from "vitest";
import {
	type BootstrapAdminConfig,
	type BootstrapAdminDependencies,
	BootstrapError,
	bootstrapFirstAdmin,
	parseBootstrapAdminEnvironment,
	SHARED_DATABASE_ACKNOWLEDGEMENT,
} from "@/features/staff/bootstrap/bootstrap";

type LockedBootstrapAdminDependencies = Parameters<Parameters<BootstrapAdminDependencies["withFirstAdminLock"]>[0]>[0];

const sentinelConfig: BootstrapAdminConfig = {
	name: "Bootstrap Operator",
	email: "sentinel-email@example.invalid",
	password: "sentinel-password-123",
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
		createAdmin: vi.fn(async () => undefined),
		...overrides,
	};
	return {
		...lockedDependencies,
		withFirstAdminLock: vi.fn((run) => run(lockedDependencies)),
	} satisfies BootstrapAdminDependencies & LockedBootstrapAdminDependencies;
}

const sensitiveSentinels = [sentinelConfig.password, sentinelConfig.email, "sentinel-raw-dependency-error"];

async function expectSafeRejection(run: () => Promise<unknown>) {
	let surfaced: unknown;
	try {
		await run();
	} catch (error) {
		surfaced = error;
	}
	expect(surfaced).toBeInstanceOf(BootstrapError);
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
		).toMatchObject({ email: "admin@example.invalid" });
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
			let surfaced: unknown;
			try {
				parseBootstrapAdminEnvironment(environment(overrides));
			} catch (error) {
				surfaced = error;
			}
			expect(surfaced).toBeInstanceOf(BootstrapError);
			const message = (surfaced as Error).message;
			expect(message).toContain(variable);
			expect(message).not.toContain("sentinel-password-123");
			expect(message).not.toContain(sentinelUrl);
		}
	});
});

describe("bootstrapFirstAdmin", () => {
	it("returns already-admin for the requested existing administrator without writing", async () => {
		const deps = dependencies({ findUserByEmail: vi.fn(async () => ({ area: "admin" as const })) });

		await expect(bootstrapFirstAdmin(sentinelConfig, deps)).resolves.toBe("already-admin");
		expect(deps.createAdmin).not.toHaveBeenCalled();
	});

	it("refuses when a different first administrator exists", async () => {
		const deps = dependencies({ findFirstAdmin: vi.fn(async () => ({ id: "different-admin" })) });

		expect(await expectSafeRejection(() => bootstrapFirstAdmin(sentinelConfig, deps))).toBe(
			"The first administrator already exists.",
		);
		expect(deps.createAdmin).not.toHaveBeenCalled();
	});

	it("refuses to promote an existing non-administrator account", async () => {
		const deps = dependencies({ findUserByEmail: vi.fn(async () => ({ area: "manager" as const })) });

		await expectSafeRejection(() => bootstrapFirstAdmin(sentinelConfig, deps));
		expect(deps.createAdmin).not.toHaveBeenCalled();
	});

	it("creates exactly one administrator under the lock", async () => {
		const deps = dependencies();

		await expect(bootstrapFirstAdmin(sentinelConfig, deps)).resolves.toBe("created");
		expect(deps.withFirstAdminLock).toHaveBeenCalledOnce();
		expect(deps.createAdmin).toHaveBeenCalledExactlyOnceWith(sentinelConfig);
	});

	it("asks for a manual review, without the raw error, when creation fails", async () => {
		const deps = dependencies({
			createAdmin: vi.fn(async () => {
				throw new Error("sentinel-raw-dependency-error");
			}),
		});

		expect(await expectSafeRejection(() => bootstrapFirstAdmin(sentinelConfig, deps))).toContain(
			"manual auth-table review",
		);
	});
});
