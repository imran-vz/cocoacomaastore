import { describe, expect, it } from "vitest";
import { upsertInventorySchema } from "@/lib/validation";

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
