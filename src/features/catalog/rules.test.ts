import { describe, expect, it } from "vitest";
import { comboSaleProblems, isComboOnSale } from "@/features/catalog/rules";
import type { DessertKind } from "@/features/catalog/schemas";

type Dessert = { name: string; kind: DessertKind; enabled: boolean; isDeleted: boolean; isOutOfStock: boolean };

const onSale = { enabled: true, isDeleted: false, isOutOfStock: false };
const base: Dessert = { ...onSale, name: "Brownie", kind: "base" };
const addOn: Dessert = { ...onSale, name: "Nutella", kind: "modifier" };
const combo = { enabled: true, isDeleted: false };

describe("combo sale rules", () => {
	it("sells a listed combo whose desserts are all on sale in their slots", () => {
		expect(comboSaleProblems(base, [addOn])).toEqual([]);
		expect(isComboOnSale(combo, base, [addOn])).toBe(true);
	});

	it("names each dessert keeping the combo off sale with its first problem", () => {
		const removedAndHidden = { ...addOn, name: "Oreo", isDeleted: true, enabled: false };
		expect(
			comboSaleProblems(base, [{ ...addOn, isOutOfStock: true }, removedAndHidden, { ...base, name: "Cake" }]),
		).toEqual([
			{ dessert: expect.objectContaining({ name: "Nutella" }), problem: "out-of-stock" },
			{ dessert: removedAndHidden, problem: "removed" },
			{ dessert: expect.objectContaining({ name: "Cake" }), problem: "wrong-kind" },
		]);
		expect(isComboOnSale(combo, base, [{ ...addOn, enabled: false }])).toBe(false);
	});

	it("doesn't sell a hidden combo or one with a dessert that wasn't found", () => {
		expect(isComboOnSale({ ...combo, enabled: false }, base, [addOn])).toBe(false);
		expect(isComboOnSale(combo, undefined, [addOn])).toBe(false);
		expect(isComboOnSale(combo, base, [undefined])).toBe(false);
	});
});
