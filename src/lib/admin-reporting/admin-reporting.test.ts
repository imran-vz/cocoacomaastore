import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requireAdmin = vi.fn();

vi.mock("@/lib/auth/guards", () => ({
	requireAdmin: () => requireAdmin(),
}));

const db = new Proxy(
	{},
	{
		get() {
			throw new Error("Admin reporting touched the database before admin auth passed");
		},
	},
);

vi.mock("@/db", () => ({ db }));

describe("Admin reporting module auth", () => {
	beforeEach(() => {
		requireAdmin.mockReset();
		requireAdmin.mockRejectedValue(new Error("Admin access required"));
	});

	it("requires admin auth before building the Admin dashboard report", async () => {
		const { getAdminDashboardReport } = await import("./index");

		await expect(getAdminDashboardReport("2026-05-31")).rejects.toThrow("Admin access required");
		expect(requireAdmin).toHaveBeenCalledTimes(1);
	});

	it("requires admin auth before building the Admin analytics report", async () => {
		const { getAdminAnalyticsReport } = await import("./index");

		await expect(getAdminAnalyticsReport("2026-05")).rejects.toThrow("Admin access required");
		expect(requireAdmin).toHaveBeenCalledTimes(1);
	});
});
