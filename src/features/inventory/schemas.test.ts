import { describe, expect, it } from "vitest";
import { stockUpdatesSchema } from "@/features/inventory/schemas";

describe("stock updates", () => {
	it("rejects two counts for the same dessert", () => {
		expect(
			stockUpdatesSchema.safeParse([
				{ dessertId: 1, expectedQuantity: 10, quantity: 11 },
				{ dessertId: 1, expectedQuantity: 10, quantity: 12 },
			]).success,
		).toBe(false);
	});
});
