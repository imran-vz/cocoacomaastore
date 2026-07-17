import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getOrders: vi.fn(),
	managerRouteGuard: vi.fn(),
}));

vi.mock("@/app/manager/orders/actions", () => ({
	getOrders: mocks.getOrders,
}));

vi.mock("@/lib/auth/guards", () => ({
	managerRouteGuard: mocks.managerRouteGuard,
}));

import { GET } from "./route";

describe("GET /api/manager/orders", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns the manager guard response without loading orders", async () => {
		const authError = new Response(null, { status: 403 });
		mocks.managerRouteGuard.mockResolvedValueOnce(authError);

		await expect(GET()).resolves.toBe(authError);
		expect(mocks.getOrders).not.toHaveBeenCalled();
	});

	it("returns orders without an aggregate revenue field", async () => {
		const orders = [{ id: 7, total: "90.00" }];
		mocks.managerRouteGuard.mockResolvedValueOnce(null);
		mocks.getOrders.mockResolvedValueOnce(orders);

		const response = await GET();
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload).toEqual(orders);
		expect(payload).not.toHaveProperty("revenue");
	});
});
