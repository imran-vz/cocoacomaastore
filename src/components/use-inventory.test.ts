import { describe, expect, it } from "vitest";
import { buildDirtyInventoryUpdates } from "./use-inventory";

describe("buildDirtyInventoryUpdates", () => {
	it("emits only a changed enabled limited-stock row with its observed quantity", () => {
		const updates = buildDirtyInventoryUpdates(
			[
				{ id: 1, enabled: true, hasUnlimitedStock: false },
				{ id: 2, enabled: true, hasUnlimitedStock: false },
			],
			{ 1: "8", 2: "3" },
			new Map([
				[1, 5],
				[2, 3],
			]),
		);

		expect(updates).toEqual([{ dessertId: 1, expectedQuantity: 5, quantity: 8 }]);
	});

	it("excludes unchanged, disabled, and unlimited-stock rows", () => {
		const updates = buildDirtyInventoryUpdates(
			[
				{ id: 1, enabled: true, hasUnlimitedStock: false },
				{ id: 2, enabled: false, hasUnlimitedStock: false },
				{ id: 3, enabled: true, hasUnlimitedStock: true },
			],
			{ 1: "5", 2: "9", 3: "9" },
			new Map([
				[1, 5],
				[2, 4],
				[3, 4],
			]),
		);

		expect(updates).toEqual([]);
	});

	it("does not truncate fractional input or coerce blank input to zero", () => {
		const updates = buildDirtyInventoryUpdates(
			[
				{ id: 1, enabled: true, hasUnlimitedStock: false },
				{ id: 2, enabled: true, hasUnlimitedStock: false },
			],
			{ 1: "1.5", 2: " " },
			new Map([
				[1, 1],
				[2, 0],
			]),
		);

		expect(updates[0]).toEqual({ dessertId: 1, expectedQuantity: 1, quantity: 1.5 });
		expect(updates[1]).toMatchObject({ dessertId: 2, expectedQuantity: 0 });
		expect(updates[1]?.quantity).toBeNaN();
	});
});
