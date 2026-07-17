import { beforeEach, describe, expect, it, vi } from "vitest";

const spies = vi.hoisted(() => ({
	requireAdmin: vi.fn(),
	requireManagerAccess: vi.fn(),
	requireSession: vi.fn(),
	getCachedOrdersCore: vi.fn(),
	getOrdersCore: vi.fn(),
	serializeOrders: vi.fn(),
	getDailyInventoryDay: vi.fn(),
	getDailyInventoryDayKey: vi.fn(),
	getInventoryForDay: vi.fn(),
	unstableCache: vi.fn((callback: () => unknown) => callback),
	databaseAccesses: { count: 0 },
}));

vi.mock("@/lib/auth/guards", () => ({
	requireAdmin: spies.requireAdmin,
	requireManagerAccess: spies.requireManagerAccess,
	requireSession: spies.requireSession,
}));

vi.mock("@/lib/order-lifecycle", () => ({
	cancelOrderAsNormalPath: vi.fn(),
	createCompletedOrder: vi.fn(),
	getCachedOrders: spies.getCachedOrdersCore,
	getOrders: spies.getOrdersCore,
	serializeOrders: spies.serializeOrders,
}));

vi.mock("@/lib/daily-inventory", () => ({
	getDailyInventoryDay: spies.getDailyInventoryDay,
	getDailyInventoryDayKey: spies.getDailyInventoryDayKey,
	getInventoryForDay: spies.getInventoryForDay,
}));

vi.mock("next/cache", () => ({ unstable_cache: spies.unstableCache }));
vi.mock("@/lib/auth", () => ({ auth: { api: { createUser: vi.fn() } } }));

vi.mock("@/db", () => ({
	db: new Proxy(
		{},
		{
			get() {
				spies.databaseAccesses.count += 1;
				throw new Error("Database accessed before authorization");
			},
		},
	),
}));

const { getOrders: getManagerOrders } = await import("@/app/manager/orders/actions");
const { getCachedOrders: getAdminOrders } = await import("@/app/admin/orders/actions");
const { getCachedManagers } = await import("@/app/admin/settings/managers/actions");
const { getCachedTodayInventory } = await import("@/app/manager/inventory/actions");

describe("server-action reader authorization", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		spies.databaseAccesses.count = 0;
		spies.requireAdmin.mockRejectedValue(new Error("Admin access required"));
		spies.requireManagerAccess.mockRejectedValue(new Error("Access required"));
		spies.getDailyInventoryDay.mockReturnValue(new Date("2026-07-16T00:00:00.000Z"));
		spies.getDailyInventoryDayKey.mockReturnValue("2026-07-16");
	});

	it("guards Manager order history before reading or serializing orders", async () => {
		await expect(getManagerOrders()).rejects.toThrow("Access required");

		expect(spies.requireManagerAccess).toHaveBeenCalledTimes(1);
		expect(spies.requireSession).not.toHaveBeenCalled();
		expect(spies.getOrdersCore).not.toHaveBeenCalled();
		expect(spies.getCachedOrdersCore).not.toHaveBeenCalled();
		expect(spies.serializeOrders).not.toHaveBeenCalled();
	});

	it("guards Admin order history before reading or serializing orders", async () => {
		await expect(getAdminOrders()).rejects.toThrow("Admin access required");

		expect(spies.requireAdmin).toHaveBeenCalledTimes(1);
		expect(spies.getCachedOrdersCore).not.toHaveBeenCalled();
		expect(spies.serializeOrders).not.toHaveBeenCalled();
	});

	it("guards the Managers list before database access", async () => {
		await expect(getCachedManagers()).rejects.toThrow("Admin access required");

		expect(spies.requireAdmin).toHaveBeenCalledTimes(1);
		expect(spies.databaseAccesses.count).toBe(0);
	});

	it("guards today's inventory before date, cache, or data work", async () => {
		await expect(getCachedTodayInventory()).rejects.toThrow("Access required");

		expect(spies.requireManagerAccess).toHaveBeenCalledTimes(1);
		expect(spies.requireSession).not.toHaveBeenCalled();
		expect(spies.getDailyInventoryDay).not.toHaveBeenCalled();
		expect(spies.getDailyInventoryDayKey).not.toHaveBeenCalled();
		expect(spies.getInventoryForDay).not.toHaveBeenCalled();
		expect(spies.unstableCache).not.toHaveBeenCalled();
	});
});
