import { describe, expect, it, vi } from "vitest";
import { asStaff, mockStaffSessions } from "@/test/staff-session";

vi.mock("server-only", () => ({}));
mockStaffSessions();
vi.mock("@/db", () => ({
	db: new Proxy(
		{},
		{
			get() {
				throw new Error("Reporting touched the database before admin auth passed");
			},
		},
	),
}));

const reporting = await import("@/features/insights/reporting");

describe("Insights reads", () => {
	it.each([
		["day report", () => reporting.getDashboardReport("2026-05-31")],
		["business weeks", () => reporting.getBusinessWeekRevenue("2026-05")],
		["analytics overview", () => reporting.getAnalyticsOverview()],
		["dessert sales", () => reporting.getDessertSales("2026-05")],
	])("refuse managers before reading the %s", async (_name, read) => {
		await expect(asStaff<unknown>({ id: "manager", area: "manager" }, read)).rejects.toThrow(
			"You don't have access to this.",
		);
	});
});
