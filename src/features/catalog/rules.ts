/** Selling rules shared by the POS, the catalog screens and order creation. */

import type { DessertKind } from "@/features/catalog/schemas";
import { formatList } from "@/lib/format";

type Listable = { enabled: boolean; isDeleted: boolean };
type Stockable = Listable & { isOutOfStock: boolean };
type ComboPart = Stockable & { kind: DessertKind };

/** A dessert can be sold right now: listed and not marked out of stock. */
export function isDessertOnSale(dessert: Stockable): boolean {
	return dessert.enabled && !dessert.isDeleted && !dessert.isOutOfStock;
}

/** Why one of a combo's desserts keeps it off sale. */
export type ComboSaleProblem<Part> = {
	dessert: Part;
	/** `wrong-kind`: an add-on in the base slot, or a base dessert among the add-ons. */
	problem: "removed" | "wrong-kind" | "hidden" | "out-of-stock";
};

/**
 * What keeps a combo's desserts from selling, base first: each dessert that is removed, of the
 * wrong kind for its slot, hidden or out of stock, with its first problem. A dessert that couldn't be
 * found (`undefined`) is reported as removed.
 */
export function comboSaleProblems<Part extends ComboPart | undefined>(
	baseDessert: Part,
	addOns: readonly Part[],
): ComboSaleProblem<Part>[] {
	return [baseDessert, ...addOns].flatMap((dessert, index) => {
		const problem: ComboSaleProblem<Part>["problem"] | null =
			!dessert || dessert.isDeleted
				? "removed"
				: dessert.kind !== (index === 0 ? "base" : "modifier")
					? "wrong-kind"
					: !dessert.enabled
						? "hidden"
						: dessert.isOutOfStock
							? "out-of-stock"
							: null;
		return problem ? [{ dessert, problem }] : [];
	});
}

/** A combo can be sold right now: it is listed and none of its desserts has a {@link comboSaleProblems problem}. */
export function isComboOnSale(
	combo: Listable,
	baseDessert: ComboPart | undefined,
	addOns: readonly (ComboPart | undefined)[],
): boolean {
	return combo.enabled && !combo.isDeleted && comboSaleProblems(baseDessert, addOns).length === 0;
}

/** `Brownie was removed from the catalog`, `Brownie and Oreo were removed from the catalog`. */
export function removedFromCatalog(names: readonly string[]): string {
	return `${formatList(names)} ${names.length === 1 ? "was" : "were"} removed from the catalog`;
}

/** A combo's price per unit: its override, or the base price plus each add-on times its quantity. */
export function comboUnitPrice(
	overridePrice: number | null,
	basePrice: number,
	addOns: readonly { price: number; quantity: number }[],
): number {
	return overridePrice ?? addOns.reduce((total, addOn) => total + addOn.price * addOn.quantity, basePrice);
}

type PricedCombo = {
	overridePrice: number | null;
	baseDessert: { price: number };
	items: readonly { quantity: number; dessert: { price: number } }[];
};

/** {@link comboUnitPrice} for a combo read with its base dessert and add-ons. */
export function comboPriceOf(combo: PricedCombo): number {
	return comboUnitPrice(
		combo.overridePrice,
		combo.baseDessert.price,
		combo.items.map((item) => ({ price: item.dessert.price, quantity: item.quantity })),
	);
}
