import { describe, expect, it } from "vitest";
import { buildOrdersViewModel } from "./orders-view-model";
import { makeSerializedOrder as makeOrder } from "./orders-view-model.fixture";

describe("orders view model", () => {
	it("normalizes display fields without mutating the source order list", () => {
		const older = makeOrder({ id: 1, createdAt: "2026-07-17T12:00:00.000Z" });
		const newer = makeOrder({ id: 2, customerName: "Asha", createdAt: "2026-07-17T14:00:00.000Z" });
		const source = [older, newer];

		const model = buildOrdersViewModel(source);

		expect(source.map((order) => order.id)).toEqual([1, 2]);
		expect(model.orders.map((order) => order.id)).toEqual([2, 1]);
		expect(model.orders[0]).toMatchObject({
			customerName: "Asha",
			isWalkInCustomer: false,
			orderLabel: "#2",
			totalItems: 2,
			itemsSummary: "Ragi Fudge Brownie ×2",
			firstItemLabel: "Ragi Fudge Brownie ×2",
			moreItemsLabel: null,
			totalLabel: "₹280",
			timeLabel: "7:30 PM",
			itemsLabel: "2 items",
			deliveryCostLabel: null,
			statusLabel: "Completed",
		});
		expect(model.orders[0]?.lines[0]).toMatchObject({ quantity: 2, lineTotalLabel: "₹180" });
		expect(model.orders[1]).toMatchObject({
			customerName: "Walk-in",
			isWalkInCustomer: true,
		});
	});

	it("preserves combo, base dessert, modifier, and delivery details", () => {
		const order = makeOrder({
			deliveryCost: "40.00",
			orderItems: [
				{
					id: 12,
					dessert: { id: 4, name: "Chocolate Muffin" },
					quantity: 1,
					unitPrice: "180.00",
					comboId: 8,
					comboName: "Muffin Party Box",
					modifiers: [
						{
							id: 22,
							dessert: { id: 5, name: "Nutella Blondie" },
							quantity: 2,
						},
					],
				},
			],
		});

		const view = buildOrdersViewModel([order]).orders[0];

		expect(view?.deliveryCostLabel).toBe("₹40");
		expect(view?.itemsSummary).toBe("Muffin Party Box");
		expect(view?.moreItemsLabel).toBeNull();
		expect(view?.lines[0]).toMatchObject({
			name: "Muffin Party Box",
			baseDessertName: "Chocolate Muffin",
			isCombo: true,
			modifiers: [{ name: "Nutella Blondie", quantity: 2 }],
		});
	});

	it("names the first line on its own and counts the other lines", () => {
		const base = makeOrder().orderItems[0];
		if (!base) throw new Error("fixture has no lines");
		const order = makeOrder({
			orderItems: [
				{ ...base, id: 31, quantity: 1, dessert: { id: 9, name: "Couverture Chocolate Fudge Brownie" } },
				{ ...base, id: 32, quantity: 3 },
				{ ...base, id: 33, quantity: 1, dessert: { id: 10, name: "Vanilla Blondie" } },
			],
		});

		const view = buildOrdersViewModel([order]).orders[0];

		expect(view?.firstItemLabel).toBe("Couverture Chocolate Fudge Brownie");
		expect(view?.moreItemsLabel).toBe("+2 more");
		expect(view?.itemsLabel).toBe("5 items");
	});

	it("keeps cancelled orders in totals while excluding them from items sold", () => {
		const completed = makeOrder({ id: 1, status: "completed" });
		const cancelled = makeOrder({ id: 2, status: "cancelled" });

		const model = buildOrdersViewModel([completed, cancelled]);

		expect(model.totalOrders).toBe(2);
		expect(model.itemsSold).toBe(2);
		expect(model).not.toHaveProperty("revenue");
		expect(model).not.toHaveProperty("netRevenue");
		expect(model.orders.find((order) => order.id === 2)).toMatchObject({
			isCancelled: true,
			statusLabel: "Cancelled",
		});
	});
});
