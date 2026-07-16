import { describe, expect, it } from "vitest";
import { createOrderWithLinesSchema, upsertInventorySchema } from "@/lib/validation";

describe("order request validation", () => {
	const submissionId = "123e4567-e89b-42d3-a456-426614174000";

	it("accepts minimal direct and combo references", () => {
		const input = {
			submissionId,
			customerName: "Customer",
			lines: [
				{ baseDessertId: 1, quantity: 2 },
				{ baseDessertId: 2, comboId: 3, quantity: 1 },
			],
			deliveryCost: "50.00",
		};

		expect(createOrderWithLinesSchema.parse(input)).toEqual(input);
	});

	it("rejects client-owned cart details", () => {
		expect(
			createOrderWithLinesSchema.safeParse({
				submissionId,
				customerName: "Customer",
				lines: [
					{
						baseDessertId: 1,
						quantity: 1,
						cartLineId: "client-line",
						baseDessertName: "Client name",
						baseDessertPrice: 0,
						hasUnlimitedStock: true,
						modifiers: [],
						unitPrice: 0,
						comboName: "Client combo",
					},
				],
				deliveryCost: "0.00",
			}).success,
		).toBe(false);
	});

	it("rejects unknown fields on the containing request", () => {
		expect(
			createOrderWithLinesSchema.safeParse({
				submissionId,
				customerName: "Customer",
				lines: [{ baseDessertId: 1, quantity: 1 }],
				deliveryCost: "0.00",
				total: 0,
			}).success,
		).toBe(false);
	});

	it("rejects a non-UUID submission identity", () => {
		expect(
			createOrderWithLinesSchema.safeParse({
				submissionId: "not-a-uuid",
				customerName: "Customer",
				lines: [{ baseDessertId: 1, quantity: 1 }],
				deliveryCost: "0.00",
			}).success,
		).toBe(false);
	});
});

describe("inventory validation", () => {
	it("accepts observed quantities across the PostgreSQL integer range", () => {
		const input = {
			updates: [
				{ dessertId: 1, expectedQuantity: -2147483648, quantity: 0 },
				{ dessertId: 2, expectedQuantity: 2147483647, quantity: 10000 },
			],
		};

		expect(upsertInventorySchema.parse(input)).toEqual(input);
	});

	it("rejects a missing expected quantity", () => {
		expect(
			upsertInventorySchema.safeParse({
				updates: [{ dessertId: 1, quantity: 10 }],
			}).success,
		).toBe(false);
	});

	it("rejects duplicate dessert IDs", () => {
		expect(
			upsertInventorySchema.safeParse({
				updates: [
					{ dessertId: 1, expectedQuantity: 10, quantity: 11 },
					{ dessertId: 1, expectedQuantity: 10, quantity: 12 },
				],
			}).success,
		).toBe(false);
	});
});
