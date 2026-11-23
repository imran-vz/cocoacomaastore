import { describe, expect, it } from "vitest";
import {
	draftsAfterConflict,
	draftsAfterSave,
	editDraft,
	pendingStock,
	type StockDrafts,
} from "@/features/inventory/stock-count";

const counted = { id: 1, enabled: true, hasUnlimitedStock: false };
const other = { id: 2, enabled: true, hasUnlimitedStock: false };
const none: StockDrafts = new Map();

describe("counting stock", () => {
	it("saves a typed count against the stored count it was typed over", () => {
		const drafts = editDraft(none, 1, "8", 5);
		expect(pendingStock([counted], drafts).updates).toEqual([{ dessertId: 1, expectedQuantity: 5, quantity: 8 }]);
	});

	it("keeps the starting count when the stored count refreshes mid-edit, so a racing order is caught as a conflict", () => {
		let drafts = editDraft(none, 1, "1", 5);
		drafts = editDraft(drafts, 1, "12", 4);
		expect(pendingStock([counted], drafts).updates).toEqual([{ dessertId: 1, expectedQuantity: 5, quantity: 12 }]);
	});

	it("drops a draft typed back to its starting count, so the field follows fresh stored counts again", () => {
		const drafts = editDraft(editDraft(none, 1, "9", 5), 1, "5", 5);
		expect(drafts.has(1)).toBe(false);
		expect(pendingStock([counted], drafts).changedIds.size).toBe(0);
	});

	it("ignores desserts that are hidden or have unlimited stock", () => {
		const drafts = editDraft(editDraft(none, 1, "3", 0), 2, "4", 0);
		const pending = pendingStock(
			[
				{ ...counted, enabled: false },
				{ ...other, hasUnlimitedStock: true },
			],
			drafts,
		);
		expect(pending).toEqual({ changedIds: new Set(), updates: [], invalid: null });
	});

	it.each([
		["", "Enter a number"],
		["1.5", "Stock must be a whole number"],
		["-2", "Stock can't be negative"],
		["10001", "Stock can be at most 10000"],
	])("holds back the save and explains why for %j", (typed, message) => {
		const drafts = editDraft(editDraft(none, 1, typed, 5), 2, "7", 0);
		const pending = pendingStock([counted, other], drafts);
		expect(pending.invalid).toBe(message);
		expect(pending.changedIds).toEqual(new Set([1, 2]));
	});

	it("after a save, clears counts that were saved and rebases ones typed while it ran", () => {
		const drafts = editDraft(editDraft(none, 1, "8", 5), 2, "9", 3);
		const saved = [
			{ dessertId: 1, expectedQuantity: 5, quantity: 8 },
			{ dessertId: 2, expectedQuantity: 3, quantity: 6 },
		];
		const next = draftsAfterSave(drafts, saved);
		expect(next.has(1)).toBe(false);
		expect(pendingStock([counted, other], next).updates).toEqual([{ dessertId: 2, expectedQuantity: 6, quantity: 9 }]);
	});

	it("after a conflict, shows the moved counts again but keeps the other typed counts", () => {
		const drafts = editDraft(editDraft(none, 1, "8", 5), 2, "9", 3);
		const next = draftsAfterConflict(drafts, [1]);
		expect(pendingStock([counted, other], next).updates).toEqual([{ dessertId: 2, expectedQuantity: 3, quantity: 9 }]);
	});
});
