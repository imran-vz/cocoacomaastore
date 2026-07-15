import { describe, expect, test } from "vitest";
import { canCancelOrderOnOperatingDay, getCartLineInventoryDeductions, serializeOrders } from "@/lib/order-lifecycle";

describe("order-lifecycle", () => {
	describe("inventory deductions", () => {
		test("aggregates cart-line base dessert quantities and ignores unlimited stock", () => {
			expect(
				getCartLineInventoryDeductions([
					{
						cartLineId: "1",
						baseDessertId: 10,
						baseDessertName: "Classic Box",
						baseDessertPrice: 100,
						quantity: 2,
						unitPrice: 100,
						hasUnlimitedStock: false,
						modifiers: [],
					},
					{
						cartLineId: "2",
						baseDessertId: 10,
						baseDessertName: "Classic Box",
						baseDessertPrice: 100,
						quantity: 4,
						unitPrice: 100,
						hasUnlimitedStock: false,
						modifiers: [],
					},
					{
						cartLineId: "3",
						baseDessertId: 11,
						baseDessertName: "Bag",
						baseDessertPrice: 0,
						quantity: 8,
						unitPrice: 0,
						hasUnlimitedStock: true,
						modifiers: [],
					},
				]),
			).toEqual([{ dessertId: 10, quantity: 6, name: "Classic Box" }]);
		});
	});

	test("only allows cancellation on the same operating day", () => {
		expect(
			canCancelOrderOnOperatingDay(new Date("2026-05-21T04:30:00.000Z"), new Date("2026-05-21T12:00:00.000Z")),
		).toBe(true);
		expect(
			canCancelOrderOnOperatingDay(new Date("2026-05-20T12:00:00.000Z"), new Date("2026-05-21T12:00:00.000Z")),
		).toBe(false);
	});

	test("serializes order dates at the client boundary", () => {
		const [serialized] = serializeOrders([
			{
				id: 42,
				customerName: "Aarav",
				createdAt: new Date("2026-07-15T09:30:00.000Z"),
				deliveryCost: "0.00",
				total: "250.00",
				status: "completed",
				orderItems: [
					{
						id: 1,
						quantity: 1,
						unitPrice: "250.00",
						comboId: null,
						comboName: null,
						dessert: { id: 1, name: "Brownie" },
						modifiers: [],
					},
				],
			},
		]);

		expect(serialized.createdAt).toBe("2026-07-15T09:30:00.000Z");
	});
});
