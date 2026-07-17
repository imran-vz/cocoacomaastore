import { describe, expect, it } from "vitest";
import { makeSerializedOrder as makeOrder } from "@/components/orders/orders-view-model.fixture";
import { buildAdminOrdersViewModel, canCancelOnSelectedDate } from "./orders-view-model";

describe("admin orders view model", () => {
	it("labels net revenue as the non-cancelled merchandise subtotal", () => {
		const model = buildAdminOrdersViewModel([
			makeOrder({ id: 1, total: "280.00", deliveryCost: "40.00" }),
			makeOrder({ id: 2, status: "pending", total: "100.50", deliveryCost: "0.00" }),
			makeOrder({ id: 3, status: "cancelled", total: "500.00", deliveryCost: "20.00" }),
		]);

		expect(model.netRevenueLabel).toBe("₹340.50");
		expect(model.totalOrders).toBe(3);
		expect(model.itemsSold).toBe(4);
	});

	it("formats a zero label when every order is cancelled", () => {
		const model = buildAdminOrdersViewModel([makeOrder({ status: "cancelled" })]);

		expect(model.netRevenueLabel).toBe("₹0.00");
		expect(model.itemsSold).toBe(0);
	});
});

describe("admin cancellation availability", () => {
	it("allows cancellation only while viewing today", () => {
		const today = new Date(2026, 6, 18);

		expect(canCancelOnSelectedDate(new Date(2026, 6, 18, 15, 30), today)).toBe(true);
		expect(canCancelOnSelectedDate(new Date(2026, 6, 17), today)).toBe(false);
		expect(canCancelOnSelectedDate(new Date(2025, 6, 18), today)).toBe(false);
	});
});
