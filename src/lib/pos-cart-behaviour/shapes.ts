import type { CartLine } from "@/lib/types";

export type InventoryByDessertId = Record<number, number>;

export type CartDessertInput = {
	id: number;
	name: string;
	price: number;
	hasUnlimitedStock: boolean;
};

export type CartComboInput = {
	id: number;
	name: string;
	baseDessertId: number;
	overridePrice: number | null;
	baseDessert: CartDessertInput;
	items: Array<{
		quantity: number;
		dessert: {
			id: number;
			name: string;
			price: number;
		};
	}>;
};

export type CartMutationResult = { ok: true; cart: CartLine[] } | { ok: false; cart: CartLine[]; error: string };

export type PosCartState = {
	cart: CartLine[];
	lastError: { id: number; message: string } | null;
};

export type PosCartEvent =
	| { type: "add-dessert"; dessert: CartDessertInput; inventoryByDessertId: InventoryByDessertId }
	| { type: "add-combo"; combo: CartComboInput; inventoryByDessertId: InventoryByDessertId }
	| { type: "remove-line"; cartLineId: string }
	| { type: "update-quantity"; cartLineId: string; quantity: number; inventoryByDessertId: InventoryByDessertId }
	| { type: "clear" };

export type SaveOrderInput = {
	cart: CartLine[];
	customerName: string;
	deliveryCost: string | number;
};

export type SaveOrderResult = { ok: true } | { ok: false; error: string };

export type SaveOrderAdapter = (input: {
	customerName: string;
	lines: CartLine[];
	deliveryCost: string;
}) => Promise<unknown>;

export type CartLineView = {
	displayName: string;
	capitalizedDisplayName: string;
	hasModifiers: boolean;
	modifierText: string;
	copyModifierText: string;
	unitPriceText: string;
	lineTotalText: string;
};

export type { CartLine };
