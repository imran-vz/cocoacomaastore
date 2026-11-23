import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Area } from "@/features/access/area";
import { asStaff, mockStaffSessions } from "@/test/staff-session";

const spies = vi.hoisted(() => ({ databaseAccesses: { count: 0 } }));

vi.mock("server-only", () => ({}));
mockStaffSessions();
vi.mock("next/cache", () => ({ unstable_cache: (read: () => unknown) => read }));
vi.mock("@/db", () => ({
	db: new Proxy(
		{},
		{
			get() {
				spies.databaseAccesses.count += 1;
				throw new Error("Database read");
			},
		},
	),
}));

const { getDayOrders } = await import("@/features/orders/queries");
const { dayKeyOf, addDays } = await import("@/lib/shop-calendar");

function readAs(area: Area, day: string) {
	return asStaff({ id: `${area}-1`, area }, () => getDayOrders(day));
}

describe("getDayOrders authorization", () => {
	beforeEach(() => {
		spies.databaseAccesses.count = 0;
	});

	it.each(["admin", "manager"] as const)("reads today for any %s", async (area) => {
		await expect(readAs(area, dayKeyOf())).rejects.toThrow("Database read");
	});

	it("opens past days for an admin", async () => {
		await expect(readAs("admin", addDays(dayKeyOf(), -1))).rejects.toThrow("Database read");
	});

	it("refuses past days to a manager before reading the database", async () => {
		await expect(readAs("manager", addDays(dayKeyOf(), -1))).rejects.toThrow("You don't have access to this.");
		expect(spies.databaseAccesses.count).toBe(0);
	});
});
