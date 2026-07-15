import { describe, expect, it } from "vitest";
import type { db as applicationDatabase } from "@/db";
import { deleteManagerAccount } from "@/lib/admin-account-deletion";

type UserState = Map<string, string>;

function createDatabase(
	users: UserState,
	targetId: string,
	events: string[] = [],
	targetOverride?: { id: string; role: string },
) {
	const database = {
		transaction: async (callback: (transaction: unknown) => unknown) => {
			let selectNumber = 0;
			const transaction = {
				select: () => {
					selectNumber += 1;
					const isAdministratorQuery = selectNumber === 1;
					const chain = {
						from: () => chain,
						where: () => chain,
						orderBy: () => {
							events.push("admins:orderBy");
							return chain;
						},
						for: async () => {
							events.push(isAdministratorQuery ? "admins:forUpdate" : "target:forUpdate");
							if (isAdministratorQuery) {
								return [...users]
									.filter(([, role]) => role === "admin")
									.map(([id]) => ({ id }))
									.sort((left, right) => left.id.localeCompare(right.id));
							}
							const role = users.get(targetId);
							return targetOverride ? [targetOverride] : role ? [{ id: targetId, role }] : [];
						},
					};
					return chain;
				},
				delete: () => ({
					where: () => ({
						returning: async () => {
							events.push("delete");
							if (!users.delete(targetId)) return [];
							return [{ id: targetId }];
						},
					}),
				}),
			};
			return callback(transaction);
		},
	};

	return database as unknown as typeof applicationDatabase;
}

describe("administrator account deletion", () => {
	it("rejects an actor who is no longer an administrator", async () => {
		const users = new Map([
			["actor", "user"],
			["admin", "admin"],
		]);
		const events: string[] = [];

		await expect(deleteManagerAccount(createDatabase(users, "admin", events), "actor", "admin")).resolves.toEqual({
			success: false,
			error: "Your administrator account is no longer active",
		});
		expect(events).toEqual(["admins:orderBy", "admins:forUpdate"]);
	});

	it("rejects self-deletion, including for the sole administrator", async () => {
		const users = new Map([["admin", "admin"]]);

		await expect(deleteManagerAccount(createDatabase(users, "admin"), "admin", "admin")).resolves.toEqual({
			success: false,
			error: "You cannot delete your own account",
		});
		expect(users.get("admin")).toBe("admin");
	});

	it("deletes another administrator when two are locked", async () => {
		const users = new Map([
			["admin-a", "admin"],
			["admin-b", "admin"],
		]);

		await expect(deleteManagerAccount(createDatabase(users, "admin-b"), "admin-a", "admin-b")).resolves.toEqual({
			success: true,
		});
		expect([...users.keys()]).toEqual(["admin-a"]);
	});

	it("locks a non-administrator target before deleting it", async () => {
		const users = new Map([
			["admin", "admin"],
			["manager", "user"],
		]);
		const events: string[] = [];

		await expect(deleteManagerAccount(createDatabase(users, "manager", events), "admin", "manager")).resolves.toEqual({
			success: true,
		});
		expect(events).toEqual(["admins:orderBy", "admins:forUpdate", "target:forUpdate", "delete"]);
	});

	it("returns an explicit result when the target is missing", async () => {
		const users = new Map([["admin", "admin"]]);

		await expect(deleteManagerAccount(createDatabase(users, "missing"), "admin", "missing")).resolves.toEqual({
			success: false,
			error: "Manager not found",
		});
	});

	it("requires a retry if the locked target has become an administrator", async () => {
		const users = new Map([
			["admin", "admin"],
			["manager", "user"],
		]);

		await expect(
			deleteManagerAccount(createDatabase(users, "manager", [], { id: "manager", role: "admin" }), "admin", "manager"),
		).resolves.toEqual({ success: false, error: "Administrator state changed; refresh and retry" });
	});

	it("serializes cross-deletes so one administrator remains", async () => {
		const users = new Map([
			["admin-a", "admin"],
			["admin-b", "admin"],
		]);

		await expect(deleteManagerAccount(createDatabase(users, "admin-b"), "admin-a", "admin-b")).resolves.toEqual({
			success: true,
		});
		await expect(deleteManagerAccount(createDatabase(users, "admin-a"), "admin-b", "admin-a")).resolves.toEqual({
			success: false,
			error: "Your administrator account is no longer active",
		});
		expect([...users.keys()]).toEqual(["admin-a"]);
	});
});
