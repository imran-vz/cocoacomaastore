import { describe, expect, it } from "vitest";
import { makeSerializedOrder as makeOrder } from "@/components/orders/orders-view-model.fixture";
import { buildManagerOrdersViewModel } from "./orders-view-model";

describe("manager orders view model adapter", () => {
	it("adds the manager date label without exposing any aggregate revenue", () => {
		const model = buildManagerOrdersViewModel([makeOrder()], "Friday, 17 July");

		expect(model.todayLabel).toBe("Friday, 17 July");
		expect(model.totalOrders).toBe(1);
		expect(model.itemsSold).toBe(2);
		expect(model.orders[0]).toMatchObject({ orderLabel: "#1", totalLabel: "₹280.00" });
		expect(model).not.toHaveProperty("revenue");
		expect(model).not.toHaveProperty("netRevenue");
		expect(model).not.toHaveProperty("netRevenueLabel");
	});
});
