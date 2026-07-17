import { describe, expect, it } from "vitest";
import { MAX_ORDER_CANCELLATION_REASON_LENGTH } from "@/lib/order-limits";
import { cancelOrderSchema, createOrderWithLinesSchema, upsertInventorySchema } from "@/lib/validation";

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

	it("accepts the maximum order line quantity and delivery cost", () => {
		const input = {
			submissionId,
			customerName: "Customer",
			lines: [{ baseDessertId: 1, quantity: 99 }],
			deliveryCost: "999.99",
		};

		expect(createOrderWithLinesSchema.parse(input)).toEqual(input);
	});

	it("rejects an order line quantity above the maximum", () => {
		expect(
			createOrderWithLinesSchema.safeParse({
				submissionId,
				customerName: "Customer",
				lines: [{ baseDessertId: 1, quantity: 100 }],
				deliveryCost: "0.00",
			}).success,
		).toBe(false);
	});

	it("rejects a delivery cost above the persistence maximum", () => {
		const result = createOrderWithLinesSchema.safeParse({
			submissionId,
			customerName: "Customer",
			lines: [{ baseDessertId: 1, quantity: 1 }],
			deliveryCost: "1000.00",
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toContainEqual(
				expect.objectContaining({ message: "Delivery cost must be between 0 and 999.99" }),
			);
		}
	});
});

describe("cancellation validation", () => {
	it("accepts the largest reason whose prefixed audit note fits", () => {
		const reason = "x".repeat(MAX_ORDER_CANCELLATION_REASON_LENGTH);
		expect(cancelOrderSchema.parse({ orderId: 1, reason })).toEqual({ orderId: 1, reason });
	});

	it("rejects a reason one character above the persisted boundary", () => {
		expect(
			cancelOrderSchema.safeParse({
				orderId: 1,
				reason: "x".repeat(MAX_ORDER_CANCELLATION_REASON_LENGTH + 1),
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
