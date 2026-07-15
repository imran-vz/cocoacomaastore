import { describe, expect, it } from "vitest";
import { summarizeOrderSales } from "@/lib/order-sales-summary";

describe("order sales summary", () => {
	it("includes completed and pending orders while excluding cancelled orders", () => {
		expect(
			summarizeOrderSales([
				{ status: "completed", total: "120.50", orderItems: [{ quantity: 2 }, { quantity: 3 }] },
				{ status: "pending", total: "30.00", orderItems: [{ quantity: 4 }] },
				{ status: "cancelled", total: "99999.00", orderItems: [{ quantity: 999 }] },
			]),
		).toEqual({ itemsSold: 9, revenue: 150.5 });
	});

	it("returns finite zero values for an empty input", () => {
		const summary = summarizeOrderSales([]);

		expect(summary).toEqual({ itemsSold: 0, revenue: 0 });
		expect(Number.isFinite(summary.itemsSold)).toBe(true);
		expect(Number.isFinite(summary.revenue)).toBe(true);
	});

	it("returns finite zero values when every order is cancelled", () => {
		const summary = summarizeOrderSales([
			{ status: "cancelled", total: "250.00", orderItems: [{ quantity: 2 }] },
			{ status: "cancelled", total: "400.00", orderItems: [{ quantity: 3 }, { quantity: 4 }] },
		]);

		expect(summary).toEqual({ itemsSold: 0, revenue: 0 });
		expect(Number.isFinite(summary.itemsSold)).toBe(true);
		expect(Number.isFinite(summary.revenue)).toBe(true);
	});
});
