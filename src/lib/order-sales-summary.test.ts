import { describe, expect, it } from "vitest";
import { summarizeOrderSales } from "@/lib/order-sales-summary";

describe("order sales summary", () => {
	it("subtracts delivery for completed and pending orders while excluding cancelled orders", () => {
		expect(
			summarizeOrderSales([
				{ status: "completed", total: "120.50", deliveryCost: "20.50", orderItems: [{ quantity: 2 }, { quantity: 3 }] },
				{ status: "pending", total: "30.00", deliveryCost: "0.00", orderItems: [{ quantity: 4 }] },
				{ status: "cancelled", total: "99999.00", deliveryCost: "10.00", orderItems: [{ quantity: 999 }] },
			]),
		).toEqual({ itemsSold: 9, netRevenue: 130 });
	});

	it("accumulates decimal amounts in integer cents without floating-point drift", () => {
		expect(
			summarizeOrderSales([
				{ status: "completed", total: "0.10", deliveryCost: "0.00", orderItems: [{ quantity: 1 }] },
				{ status: "completed", total: "0.20", deliveryCost: "0.00", orderItems: [{ quantity: 1 }] },
				{ status: "pending", total: "10.05", deliveryCost: "0.05", orderItems: [{ quantity: 1 }] },
			]),
		).toEqual({ itemsSold: 3, netRevenue: 10.3 });
	});

	it("returns finite zero values for an empty input", () => {
		const summary = summarizeOrderSales([]);

		expect(summary).toEqual({ itemsSold: 0, netRevenue: 0 });
		expect(Number.isFinite(summary.itemsSold)).toBe(true);
		expect(Number.isFinite(summary.netRevenue)).toBe(true);
	});

	it("returns finite zero values when every order is cancelled", () => {
		const summary = summarizeOrderSales([
			{ status: "cancelled", total: "250.00", deliveryCost: "40.00", orderItems: [{ quantity: 2 }] },
			{ status: "cancelled", total: "400.00", deliveryCost: "0.00", orderItems: [{ quantity: 3 }, { quantity: 4 }] },
		]);

		expect(summary).toEqual({ itemsSold: 0, netRevenue: 0 });
		expect(Number.isFinite(summary.itemsSold)).toBe(true);
		expect(Number.isFinite(summary.netRevenue)).toBe(true);
	});
});
