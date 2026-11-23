import { describe, expect, it } from "vitest";
import {
	formChoices,
	isSameForm,
	removedDesserts,
	setAddOnQuantity,
	toComboInput,
	toFormValues,
	toggleAddOn,
} from "@/features/catalog/combo-form";
import type { ComboWithDetails } from "@/features/catalog/queries";

const availability = { enabled: true, isDeleted: false, isOutOfStock: false };
const combo: ComboWithDetails = {
	id: 7,
	name: "Brownie combo",
	baseDessertId: 10,
	overridePrice: null,
	enabled: true,
	isDeleted: false,
	baseDessert: { id: 10, name: "Brownie", price: 100, kind: "base", hasUnlimitedStock: false, ...availability },
	items: [
		{
			id: 1,
			dessertId: 20,
			quantity: 2,
			dessert: { id: 20, name: "Nutella", price: 30, kind: "modifier", ...availability, enabled: false },
		},
	],
};

describe("combo form", () => {
	it("opens an existing combo with its saved values, unchanged until edited", () => {
		const values = toFormValues(combo);
		expect(values).toEqual({
			name: "Brownie combo",
			baseDessertId: 10,
			overridePrice: "",
			enabled: true,
			addOns: [{ dessertId: 20, quantity: 2 }],
		});
		expect(isSameForm(values, toFormValues(combo))).toBe(true);
		expect(isSameForm(setAddOnQuantity(values, 20, 3), values)).toBe(false);
	});

	it("turns the form into one save request for the combo, add-ons included", () => {
		const values = { ...toggleAddOn(toFormValues(combo), 21), overridePrice: "150" };
		expect(toComboInput(values, combo.id)).toEqual({
			ok: true,
			input: {
				id: 7,
				name: "Brownie combo",
				baseDessertId: 10,
				overridePrice: 150,
				enabled: true,
				addOns: [
					{ dessertId: 20, quantity: 2 },
					{ dessertId: 21, quantity: 1 },
				],
			},
		});
	});

	it("explains what is missing before anything is sent", () => {
		const blank = toFormValues(null);
		expect(toComboInput(blank, undefined)).toEqual({ ok: false, error: "Name is required" });
		expect(toComboInput({ ...blank, name: "Combo" }, undefined)).toEqual({ ok: false, error: "Pick a base dessert" });
		expect(toComboInput({ ...blank, name: "Combo", baseDessertId: 10 }, undefined)).toEqual({
			ok: false,
			error: "Pick at least one add-on",
		});
		expect(
			toComboInput(
				{ ...toggleAddOn({ ...blank, name: "Combo", baseDessertId: 10 }, 20), overridePrice: "9.5" },
				undefined,
			),
		).toEqual({ ok: false, error: "Price must be a whole number of rupees" });
	});

	it("offers a combo's current base and add-ons even when they are no longer on sale", () => {
		const choices = formChoices({ bases: [{ id: 11, name: "Cake", price: 90 }], addOns: [] }, combo);
		expect(choices.bases.map(({ id }) => id)).toEqual([11, 10]);
		expect(choices.addOns.map(({ id }) => id)).toEqual([20]);
		expect(formChoices({ bases: [], addOns: [] }, null)).toEqual({ bases: [], addOns: [] });
	});

	it("opens a combo without the desserts removed from the catalog, and names them", () => {
		const removed = { ...availability, isDeleted: true };
		const stale: ComboWithDetails = {
			...combo,
			baseDessert: { ...combo.baseDessert, ...removed },
			items: [
				...combo.items,
				{
					id: 2,
					dessertId: 21,
					quantity: 1,
					dessert: { id: 21, name: "Oreo", price: 20, kind: "modifier", ...removed },
				},
			],
		};

		expect(toFormValues(stale)).toMatchObject({ baseDessertId: null, addOns: [{ dessertId: 20, quantity: 2 }] });
		expect(removedDesserts(stale)).toEqual(["Brownie", "Oreo"]);
		const choices = formChoices({ bases: [{ id: 11, name: "Cake", price: 90 }], addOns: [] }, stale);
		expect(choices.bases.map(({ id }) => id)).toEqual([11]);
		expect(choices.addOns.map(({ id }) => id)).toEqual([20]);
	});
});
