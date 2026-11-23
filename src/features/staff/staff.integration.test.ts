import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { userTable } from "@/db/schema";
import { STAFF_TAGS } from "@/features/staff/tags";
import { closeIntegrationDatabase, integrationDb, resetIntegrationData } from "@/test/integration/database";
import { asStaff, mockStaffSessions } from "@/test/staff-session";

vi.doMock("server-only", () => ({}));
vi.doMock("@/db", () => ({ db: integrationDb }));
vi.doMock("next/cache", () => ({ updateTag: vi.fn() }));
mockStaffSessions();

const { deleteStaffAccount } = await import("@/features/staff/actions");
const { listStaffAccounts } = await import("@/features/staff/queries");

async function seed(accounts: Record<string, "admin" | "user">) {
	await integrationDb
		.insert(userTable)
		.values(Object.entries(accounts).map(([id, role]) => ({ id, name: id, email: `${id}@example.com`, role })));
}

async function remainingIds() {
	return (await integrationDb.select({ id: userTable.id }).from(userTable)).map(({ id }) => id).sort();
}

beforeEach(async () => {
	await resetIntegrationData();
});
afterAll(closeIntegrationDatabase);

describe("listing staff accounts", () => {
	it("lists every account, oldest first, for admins only", async () => {
		await seed({ admin: "admin" });
		await seed({ manager: "user" });

		expect(await asStaff({ id: "admin", area: "admin" }, listStaffAccounts)).toMatchObject([
			{ id: "admin", area: "admin" },
			{ id: "manager", area: "manager" },
		]);
		await expect(asStaff({ id: "manager", area: "manager" }, listStaffAccounts)).rejects.toThrow(
			"You don't have access to this.",
		);
	});
});

describe("deleting staff accounts", () => {
	it("deletes a manager and another administrator", async () => {
		await seed({ "admin-a": "admin", "admin-b": "admin", manager: "user" });
		const adminA = { id: "admin-a", area: "admin" } as const;

		const deleted = { ok: true, data: undefined, refreshed: STAFF_TAGS };
		expect(await asStaff(adminA, () => deleteStaffAccount("manager"))).toEqual(deleted);
		expect(await asStaff(adminA, () => deleteStaffAccount("admin-b"))).toEqual(deleted);
		expect(await remainingIds()).toEqual(["admin-a"]);
	});

	it("refuses self-deletion, a missing account, and an actor who is no longer an administrator", async () => {
		await seed({ admin: "admin", demoted: "user" });
		const admin = { id: "admin", area: "admin" } as const;

		expect(await asStaff(admin, () => deleteStaffAccount("admin"))).toEqual({
			ok: false,
			error: "You cannot delete your own account",
		});
		expect(await asStaff(admin, () => deleteStaffAccount("missing"))).toEqual({
			ok: false,
			error: "Account not found",
		});
		// A session read before the demotion still says admin; the write re-checks the role.
		expect(await asStaff({ id: "demoted", area: "admin" }, () => deleteStaffAccount("admin"))).toEqual({
			ok: false,
			error: "Your administrator account is no longer active",
		});
		expect(await remainingIds()).toEqual(["admin", "demoted"]);
	});

	it("leaves one administrator when two delete each other at the same time", async () => {
		await seed({ "admin-a": "admin", "admin-b": "admin" });

		const attempts = await Promise.all([
			asStaff({ id: "admin-a", area: "admin" }, () => deleteStaffAccount("admin-b")),
			asStaff({ id: "admin-b", area: "admin" }, () => deleteStaffAccount("admin-a")),
		]);

		expect(attempts.filter((result) => result.ok)).toHaveLength(1);
		expect(await remainingIds()).toHaveLength(1);
	});

	it("is refused to managers and to anyone signed out", async () => {
		await seed({ admin: "admin", manager: "user" });

		expect(await asStaff({ id: "manager", area: "manager" }, () => deleteStaffAccount("admin"))).toEqual({
			ok: false,
			error: "You don't have access to this.",
		});
		expect(await asStaff(null, () => deleteStaffAccount("admin"))).toEqual({
			ok: false,
			error: "Your session has ended. Sign in again.",
		});
		expect(await remainingIds()).toEqual(["admin", "manager"]);
	});
});
