import { beforeEach, describe, expect, it, vi } from "vitest";
import { asStaff, mockStaffSessions } from "@/test/staff-session";

const databaseReads = vi.hoisted(() => ({ count: 0 }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (read: () => unknown) => read }));
mockStaffSessions();
vi.mock("@/db", () => ({
	db: new Proxy(
		{},
		{
			get() {
				databaseReads.count += 1;
				throw new Error("Database read before the staff check");
			},
		},
	),
}));

const { getCatalogDesserts, getComboCatalog, getDesserts, getEnabledCombos } = await import(
	"@/features/catalog/queries"
);

describe("catalog reads", () => {
	beforeEach(() => {
		databaseReads.count = 0;
	});

	it.each([
		["the Sell screen's desserts", getDesserts],
		["the catalog's desserts", getCatalogDesserts],
		["enabled combos", getEnabledCombos],
		["the combo catalog", getComboCatalog],
	])("refuse %s to anyone signed out, before reading the database", async (_name, read) => {
		await expect(asStaff<unknown>(null, read)).rejects.toThrow("Your session has ended");
		expect(databaseReads.count).toBe(0);
	});
});
