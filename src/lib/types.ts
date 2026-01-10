import type { Dessert as DBDessert, DessertCombo } from "@/db/schema";

export type Dessert = DBDessert & {
	inventoryQuantity?: number;
};

// Legacy CartItem - still used for simple cases (base dessert only)
export interface CartItem extends Dessert {
	quantity: number;
}

// ============================================================================
// Cart Line - new structure for variants/combos with modifiers
// ============================================================================

export interface CartLineModifier {
	dessertId: number;
	name: string;
	price: number;
	quantity: number; // quantity per unit of the cart line
}

export interface CartLine {
	cartLineId: string; // unique client-generated id (allows same base with different modifiers)
	baseDessertId: number;
	baseDessertName: string;
	baseDessertPrice: number;
	hasUnlimitedStock: boolean;
	modifiers: CartLineModifier[];
	unitPrice: number; // snapshotted computed price per unit
	quantity: number; // line quantity
	// Optional: if this cart line came from a combo
	comboId?: number;
	comboName?: string;
}

// ============================================================================
// Combo with relations - for UI display
// ============================================================================

export interface ComboWithDetails extends DessertCombo {
	baseDessert: {
		id: number;
		name: string;
		price: number;
		hasUnlimitedStock: boolean;
	};
	items: Array<{
		id: number;
		dessertId: number;
		quantity: number;
		dessert: {
			id: number;
			name: string;
			price: number;
		};
	}>;
}
