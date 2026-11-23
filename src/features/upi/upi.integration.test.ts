import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { upiAccountsTable } from "@/db/schema";
import { UPI_TAGS } from "@/features/upi/tags";
import { closeIntegrationDatabase, integrationDb, resetIntegrationData } from "@/test/integration/database";
import { createTaggedCache } from "@/test/integration/tagged-cache";
import { asStaff, mockStaffSessions } from "@/test/staff-session";

const cache = createTaggedCache();

vi.doMock("server-only", () => ({}));
vi.doMock("@/db", () => ({ db: integrationDb }));
vi.doMock("next/cache", () => cache.nextCache);
mockStaffSessions();

const { createUpiAccount, deleteUpiAccount, updateUpiAccount } = await import("@/features/upi/actions");
const { getCheckoutUpiAccounts, listUpiAccounts } = await import("@/features/upi/queries");

const admin = { id: "admin", area: "admin" } as const;
const manager = { id: "manager", area: "manager" } as const;
const MISSING_ID = "00000000-0000-4000-8000-000000000000";

beforeEach(async () => {
	cache.clear();
	await resetIntegrationData();
});
afterAll(closeIntegrationDatabase);

/** A change answered as done, naming what it refreshed for the client. */
const changed = { ok: true, data: undefined, refreshed: UPI_TAGS };

async function create(label: string, upiId: string, enabled = true) {
	expect(await asStaff(admin, () => createUpiAccount({ label, upiId, enabled }))).toEqual(changed);
	const accounts = await asStaff(admin, listUpiAccounts);
	const account = accounts.find((candidate) => candidate.label === label);
	if (!account) throw new Error(`${label} was not created`);
	return account;
}

describe("UPI accounts", () => {
	it("creates, edits, disables and deletes accounts, and checkout sees each change", async () => {
		const checkout = () => asStaff(manager, getCheckoutUpiAccounts);
		expect(await checkout()).toEqual([]);

		const shop = await create("Shop", " Shop@Bank ");
		expect(shop).toMatchObject({ label: "Shop", upiId: "shop@bank", enabled: true });
		expect(await checkout()).toEqual([{ id: shop.id, label: "Shop", upiId: "shop@bank" }]);

		expect(
			await asStaff(admin, () => updateUpiAccount(shop.id, { label: "Counter", upiId: "counter@bank", enabled: true })),
		).toEqual(changed);
		expect(await checkout()).toEqual([{ id: shop.id, label: "Counter", upiId: "counter@bank" }]);

		await asStaff(admin, () => updateUpiAccount(shop.id, { label: "Counter", upiId: "counter@bank", enabled: false }));
		expect(await checkout()).toEqual([]);
		expect(await asStaff(admin, listUpiAccounts)).toMatchObject([{ id: shop.id, enabled: false }]);

		expect(await asStaff(admin, () => deleteUpiAccount(shop.id))).toEqual(changed);
		expect(await asStaff(admin, listUpiAccounts)).toEqual([]);
	});

	it("offers checkout only the enabled accounts, oldest first, as id, label and UPI ID", async () => {
		const first = await create("First", "first@bank");
		await create("Hidden", "hidden@bank", false);
		const third = await create("Third", "third@bank");

		expect(await asStaff(manager, getCheckoutUpiAccounts)).toEqual([
			{ id: first.id, label: "First", upiId: "first@bank" },
			{ id: third.id, label: "Third", upiId: "third@bank" },
		]);
	});

	it("reports a missing or deleted account instead of succeeding", async () => {
		const gone = await create("Gone", "gone@bank");
		await asStaff(admin, () => deleteUpiAccount(gone.id));
		const input = { label: "Again", upiId: "again@bank", enabled: true };

		for (const id of [MISSING_ID, gone.id]) {
			expect(await asStaff(admin, () => updateUpiAccount(id, input))).toEqual({
				ok: false,
				error: "UPI account not found",
			});
			expect(await asStaff(admin, () => deleteUpiAccount(id))).toEqual({ ok: false, error: "UPI account not found" });
		}
	});

	it("rejects an invalid UPI ID", async () => {
		expect(
			await asStaff(admin, () => createUpiAccount({ label: "Shop", upiId: "not-a-upi-id", enabled: true })),
		).toEqual({ ok: false, error: "Invalid UPI ID format (e.g., user@bank)" });
		expect(await integrationDb.select().from(upiAccountsTable)).toEqual([]);
	});

	it("leaves account management to admins", async () => {
		const shop = await create("Shop", "shop@bank");
		const refused = { ok: false, error: "You don't have access to this." };

		expect(await asStaff(manager, () => createUpiAccount({ label: "X", upiId: "x@bank", enabled: true }))).toEqual(
			refused,
		);
		expect(await asStaff(manager, () => deleteUpiAccount(shop.id))).toEqual(refused);
		await expect(asStaff(manager, listUpiAccounts)).rejects.toThrow("You don't have access to this.");
	});
});
