import { beforeEach, describe, expect, it, vi } from "vitest";

const spies = vi.hoisted(() => ({
	requireAdmin: vi.fn(),
	createUser: vi.fn(),
	deleteManagerAccount: vi.fn(),
	updateCache: vi.fn(),
	databaseAttempts: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({ requireAdmin: spies.requireAdmin }));
vi.mock("@/lib/auth", () => ({ auth: { api: { createUser: spies.createUser } } }));
vi.mock("@/lib/admin-account-deletion", () => ({ deleteManagerAccount: spies.deleteManagerAccount }));
vi.mock("@/db", () => ({ db: { marker: "database" } }));
vi.mock("@/server/effect/cache-tags", async () => {
	const { Effect } = await import("effect");
	return {
		CacheTag: { managers: "managers" },
		updateNextCacheEffect: (options: unknown) => Effect.sync(() => spies.updateCache(options)),
	};
});
vi.mock("@/server/effect/next-runtime", async () => {
	const { Effect } = await import("effect");
	const { Database } = await import("@/server/effect/services/db");
	const databaseService = {
		db: { marker: "database" },
		attempt: (operation: string, run: (database: unknown) => Promise<unknown>) => {
			spies.databaseAttempts(operation);
			return Effect.promise(() => run({ marker: "transaction-database" }));
		},
	} as unknown as import("effect").Context.Tag.Service<typeof Database>;
	return {
		runNextAppEffect: (effect: unknown) =>
			Effect.runPromise(
				(
					effect as import("effect").Effect.Effect<unknown, unknown, import("@/server/effect/services/db").Database>
				).pipe(Effect.provideService(Database, databaseService)),
			),
	};
});

const { createManager, deleteManager } = await import("@/app/admin/settings/managers/actions");

describe("createManager", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		spies.requireAdmin.mockResolvedValue({ id: "actor-id" });
		spies.createUser.mockResolvedValue({ user: { id: "created-id" } });
	});

	it("authorizes before provisioning through the trusted server API", async () => {
		const callOrder: string[] = [];
		spies.requireAdmin.mockImplementation(async () => {
			callOrder.push("authorize");
			return { id: "actor-id" };
		});
		spies.createUser.mockImplementation(async () => {
			callOrder.push("create");
			return { user: { id: "created-id" } };
		});

		await expect(
			createManager({
				name: "Store Manager",
				email: "Manager@Example.COM",
				password: "secure-password-123",
				role: "admin",
			}),
		).resolves.toEqual({ success: true });

		expect(callOrder).toEqual(["authorize", "create"]);
		expect(spies.createUser).toHaveBeenCalledWith({
			body: {
				name: "Store Manager",
				email: "manager@example.com",
				password: "secure-password-123",
				role: "admin",
			},
		});
		expect(spies.updateCache).toHaveBeenCalledWith({
			tags: ["managers"],
			paths: ["/admin/settings/managers", "/admin/managers"],
		});
	});

	it.each(["admin", "user"] as const)("passes the supported %s role to Better Auth", async (role) => {
		await createManager({
			name: "Store Manager",
			email: `${role}@example.com`,
			password: "secure-password-123",
			role,
		});

		expect(spies.createUser).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ role }) }));
	});

	it("stops before validation and provisioning when Admin authorization fails", async () => {
		spies.requireAdmin.mockRejectedValue(new Error("Admin access required"));

		await expect(
			createManager({
				name: "Store Manager",
				email: "not-an-email",
				password: "short",
				role: "user",
			}),
		).rejects.toThrow("Admin access required");
		expect(spies.createUser).not.toHaveBeenCalled();
	});

	it("returns a safe failure and leaves caches untouched when provisioning fails", async () => {
		spies.createUser.mockRejectedValue(new Error("provider detail"));
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

		await expect(
			createManager({
				name: "Store Manager",
				email: "manager@example.com",
				password: "secure-password-123",
				role: "user",
			}),
		).resolves.toEqual({ success: false, error: "Failed to create manager" });
		expect(spies.updateCache).not.toHaveBeenCalled();

		errorSpy.mockRestore();
	});
});

describe("deleteManager", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		spies.requireAdmin.mockResolvedValue({ id: "actor-id" });
	});

	it("stops before deletion when Admin authorization fails", async () => {
		spies.requireAdmin.mockRejectedValue(new Error("Admin access required"));

		await expect(deleteManager("target-id")).rejects.toThrow("Admin access required");
		expect(spies.deleteManagerAccount).not.toHaveBeenCalled();
	});

	it("passes authenticated actor and validated target IDs through the database attempt", async () => {
		spies.deleteManagerAccount.mockResolvedValue({ success: false, error: "Manager not found" });

		await deleteManager("target-id");

		expect(spies.databaseAttempts).toHaveBeenCalledWith("delete manager");
		expect(spies.deleteManagerAccount).toHaveBeenCalledWith(
			{ marker: "transaction-database" },
			"actor-id",
			"target-id",
		);
	});

	it("returns a policy block without invalidating caches", async () => {
		const result = { success: false, error: "You cannot delete your own account" } as const;
		spies.deleteManagerAccount.mockResolvedValue(result);

		await expect(deleteManager("target-id")).resolves.toEqual(result);
		expect(spies.updateCache).not.toHaveBeenCalled();
	});

	it("invalidates the existing Manager caches after successful deletion", async () => {
		spies.deleteManagerAccount.mockResolvedValue({ success: true });

		await expect(deleteManager("target-id")).resolves.toEqual({ success: true });
		expect(spies.updateCache).toHaveBeenCalledTimes(1);
		expect(spies.updateCache).toHaveBeenCalledWith({
			tags: ["managers"],
			paths: ["/admin/settings/managers", "/admin/managers"],
		});
	});
});
