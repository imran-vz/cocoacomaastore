import type { ComboCatalog, ComboChoice, ComboWithDetails } from "@/features/catalog/queries";
import { type ComboInput, comboInputSchema } from "@/features/catalog/schemas";

/** What the combo form holds while it is being edited. */
export type ComboFormValues = {
	name: string;
	baseDessertId: number | null;
	/** As typed; empty means "base plus add-ons". */
	overridePrice: string;
	enabled: boolean;
	addOns: { dessertId: number; quantity: number }[];
};

/** A combo's saved values, without desserts since removed from the catalog (they can't be saved again). */
export function toFormValues(combo: ComboWithDetails | null): ComboFormValues {
	if (!combo) return { name: "", baseDessertId: null, overridePrice: "", enabled: true, addOns: [] };
	return {
		name: combo.name,
		baseDessertId: combo.baseDessert.isDeleted ? null : combo.baseDessertId,
		overridePrice: combo.overridePrice?.toString() ?? "",
		enabled: combo.enabled,
		addOns: combo.items
			.filter(({ dessert }) => !dessert.isDeleted)
			.map(({ dessertId, quantity }) => ({ dessertId, quantity })),
	};
}

/** Names of the desserts `combo` uses that were removed from the catalog. */
export function removedDesserts(combo: ComboWithDetails | null): string[] {
	if (!combo) return [];
	return [combo.baseDessert, ...combo.items.map(({ dessert }) => dessert)]
		.filter((dessert) => dessert.isDeleted)
		.map(({ name }) => name);
}

export function isSameForm(a: ComboFormValues, b: ComboFormValues) {
	if (a.name !== b.name || a.baseDessertId !== b.baseDessertId) return false;
	if (a.overridePrice !== b.overridePrice || a.enabled !== b.enabled) return false;
	if (a.addOns.length !== b.addOns.length) return false;
	const quantities = new Map(b.addOns.map((addOn) => [addOn.dessertId, addOn.quantity]));
	return a.addOns.every((addOn) => quantities.get(addOn.dessertId) === addOn.quantity);
}

export function toggleAddOn(values: ComboFormValues, dessertId: number): ComboFormValues {
	const picked = values.addOns.some((addOn) => addOn.dessertId === dessertId);
	return {
		...values,
		addOns: picked
			? values.addOns.filter((addOn) => addOn.dessertId !== dessertId)
			: [...values.addOns, { dessertId, quantity: 1 }],
	};
}

export function setAddOnQuantity(values: ComboFormValues, dessertId: number, quantity: number): ComboFormValues {
	return {
		...values,
		addOns: values.addOns.map((addOn) => (addOn.dessertId === dessertId ? { ...addOn, quantity } : addOn)),
	};
}

/** The form's values as a save request for `comboId` (absent for a new combo), or the first reason they can't be saved. */
export function toComboInput(
	values: ComboFormValues,
	comboId: number | undefined,
): { ok: true; input: ComboInput } | { ok: false; error: string } {
	const price = values.overridePrice.trim();
	const input = {
		id: comboId,
		name: values.name,
		baseDessertId: values.baseDessertId ?? Number.NaN,
		overridePrice: price === "" ? null : Number(price),
		enabled: values.enabled,
		addOns: values.addOns,
	};
	const parsed = comboInputSchema.safeParse(input);
	return parsed.success
		? { ok: true, input }
		: { ok: false, error: parsed.error.issues[0]?.message ?? "Check the combo" };
}

/**
 * The bases and add-ons the form offers for `combo`: everything on sale, plus whatever the combo
 * already uses that is now hidden, so editing it shows (and keeps) its current choices. Desserts
 * removed from the catalog are not offered.
 */
export function formChoices(catalog: Pick<ComboCatalog, "bases" | "addOns">, combo: ComboWithDetails | null) {
	const withCurrent = (choices: ComboChoice[], current: (ComboChoice & { isDeleted: boolean })[]) => [
		...choices,
		...current.filter((choice) => !choice.isDeleted && !choices.some(({ id }) => id === choice.id)),
	];
	return {
		bases: withCurrent(catalog.bases, combo ? [combo.baseDessert] : []),
		addOns: withCurrent(catalog.addOns, combo ? combo.items.map(({ dessert }) => dessert) : []),
	};
}
