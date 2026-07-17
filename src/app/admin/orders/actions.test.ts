import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	requireAdmin: vi.fn(),
	cancelOrderAsNormalPath: vi.fn(),
	getCachedOrders: vi.fn(),
	serializeOrders: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
	requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/order-lifecycle", () => ({
	cancelOrderAsNormalPath: mocks.cancelOrderAsNormalPath,
	getCachedOrders: mocks.getCachedOrders,
	serializeOrders: mocks.serializeOrders,
}));

import { cancelOrder } from "./actions";

describe("admin cancelOrder action", () => {
	it("requires an admin before validating or touching the lifecycle", async () => {
		mocks.requireAdmin.mockRejectedValueOnce(new Error("Admin access required"));

		await expect(cancelOrder(-1)).rejects.toThrow("Admin access required");

		expect(mocks.cancelOrderAsNormalPath).not.toHaveBeenCalled();
	});

	it("rejects invalid order ids after the admin guard passes", async () => {
		mocks.requireAdmin.mockResolvedValueOnce({ id: "admin-1" });

		await expect(cancelOrder(0)).rejects.toThrow();

		expect(mocks.cancelOrderAsNormalPath).not.toHaveBeenCalled();
	});

	it("passes the authenticated admin id and trimmed reason to the lifecycle", async () => {
		mocks.requireAdmin.mockResolvedValueOnce({ id: "admin-1" });
		mocks.cancelOrderAsNormalPath.mockResolvedValueOnce(undefined);

		await cancelOrder(42, "  Duplicate order  ");

		expect(mocks.cancelOrderAsNormalPath).toHaveBeenCalledWith(42, "admin-1", "Duplicate order");
	});

	it("omits the reason when none is provided", async () => {
		mocks.requireAdmin.mockResolvedValueOnce({ id: "admin-1" });
		mocks.cancelOrderAsNormalPath.mockResolvedValueOnce(undefined);

		await cancelOrder(7);

		expect(mocks.cancelOrderAsNormalPath).toHaveBeenCalledWith(7, "admin-1", undefined);
	});

	it("propagates lifecycle failures such as the operating-day guard", async () => {
		mocks.requireAdmin.mockResolvedValueOnce({ id: "admin-1" });
		mocks.cancelOrderAsNormalPath.mockRejectedValueOnce(
			new Error("Cannot cancel an order from a previous operating day"),
		);

		await expect(cancelOrder(42)).rejects.toThrow("Cannot cancel an order from a previous operating day");
	});
});
