/**
 * Order Resolution Module
 *
 * Resolves user selections (combo or base + modifiers) into cart lines.
 * Validates inventory, computes pricing, and returns a CartLine ready for the cart.
 *
 * Rules enforced:
 * - Inventory is only validated/deducted for base desserts
 * - Combos resolve to base + modifiers, never create new dessert rows
 * - Prices are snapshotted at resolution time
 * - If combo has overridePrice, use it; otherwise compute from base + modifiers
 */

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	dailyDessertInventoryTable,
	dessertCombosTable,
	dessertsTable,
} from "@/db/schema";
import type { CartLine, CartLineModifier, ComboWithDetails } from "./types";

// ============================================================================
// Types
// ============================================================================

export interface ResolveComboRequest {
	comboId: number;
	quantity: number;
}

export interface ResolveVariantRequest {
	baseDessertId: number;
	modifiers: Array<{ dessertId: number; quantity: number }>;
	quantity: number;
}

export interface ResolutionResult {
	success: true;
	cartLine: CartLine;
}

export interface ResolutionError {
	success: false;
	error: string;
}

export type ResolveResult = ResolutionResult | ResolutionError;

// ============================================================================
// Helpers
// ============================================================================

function getStartOfDay(date: Date = new Date()): Date {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

function generateCartLineId(): string {
	return `cl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================================
// Resolution Functions
// ============================================================================

/**
 * Resolves a combo selection into a cart line.
 */
export async function resolveCombo(
	request: ResolveComboRequest,
): Promise<ResolveResult> {
	const { comboId, quantity } = request;

	// Load combo with base dessert and items
	const combo = await db.query.dessertCombosTable.findFirst({
		where: and(
			eq(dessertCombosTable.id, comboId),
			eq(dessertCombosTable.isDeleted, false),
			eq(dessertCombosTable.enabled, true),
		),
		with: {
			baseDessert: {
				columns: {
					id: true,
					name: true,
					price: true,
					enabled: true,
					isDeleted: true,
					isOutOfStock: true,
					hasUnlimitedStock: true,
				},
			},
			items: {
				with: {
					dessert: {
						columns: {
							id: true,
							name: true,
							price: true,
						},
					},
				},
			},
		},
	});

	if (!combo) {
		return { success: false, error: "Combo not found or disabled" };
	}

	const { baseDessert } = combo;

	// Validate base dessert availability
	if (baseDessert.isDeleted || !baseDessert.enabled) {
		return { success: false, error: `${baseDessert.name} is not available` };
	}

	if (baseDessert.isOutOfStock) {
		return { success: false, error: `${baseDessert.name} is out of stock` };
	}

	// Check inventory for base dessert (only if not unlimited stock)
	if (!baseDessert.hasUnlimitedStock) {
		const inventoryResult = await validateBaseInventory(
			baseDessert.id,
			quantity,
		);
		if (!inventoryResult.success) {
			return inventoryResult;
		}
	}

	// Build modifiers from combo items
	const modifiers: CartLineModifier[] = combo.items.map((item) => ({
		dessertId: item.dessert.id,
		name: item.dessert.name,
		price: item.dessert.price,
		quantity: item.quantity,
	}));

	// Compute unit price
	const unitPrice = computeUnitPrice(
		baseDessert.price,
		modifiers,
		combo.overridePrice,
	);

	const cartLine: CartLine = {
		cartLineId: generateCartLineId(),
		baseDessertId: baseDessert.id,
		baseDessertName: baseDessert.name,
		baseDessertPrice: baseDessert.price,
		hasUnlimitedStock: baseDessert.hasUnlimitedStock,
		modifiers,
		unitPrice,
		quantity,
		comboId: combo.id,
		comboName: combo.name,
	};

	return { success: true, cartLine };
}

/**
 * Resolves a variant selection (base + selected modifiers) into a cart line.
 */
export async function resolveVariant(
	request: ResolveVariantRequest,
): Promise<ResolveResult> {
	const { baseDessertId, modifiers: requestedModifiers, quantity } = request;

	// Load base dessert
	const baseDessert = await db.query.dessertsTable.findFirst({
		where: and(
			eq(dessertsTable.id, baseDessertId),
			eq(dessertsTable.isDeleted, false),
			eq(dessertsTable.enabled, true),
		),
		columns: {
			id: true,
			name: true,
			price: true,
			isOutOfStock: true,
			hasUnlimitedStock: true,
		},
	});

	if (!baseDessert) {
		return { success: false, error: "Base dessert not found or disabled" };
	}

	if (baseDessert.isOutOfStock) {
		return { success: false, error: `${baseDessert.name} is out of stock` };
	}

	// Check inventory for base dessert (only if not unlimited stock)
	if (!baseDessert.hasUnlimitedStock) {
		const inventoryResult = await validateBaseInventory(
			baseDessert.id,
			quantity,
		);
		if (!inventoryResult.success) {
			return inventoryResult;
		}
	}

	// Load modifier desserts
	const modifiers: CartLineModifier[] = [];
	if (requestedModifiers.length > 0) {
		const modifierIds = requestedModifiers.map((m) => m.dessertId);
		const modifierDesserts = await db
			.select({
				id: dessertsTable.id,
				name: dessertsTable.name,
				price: dessertsTable.price,
			})
			.from(dessertsTable)
			.where(
				and(
					sql`${dessertsTable.id} IN (${sql.join(modifierIds, sql`, `)})`,
					eq(dessertsTable.isDeleted, false),
					eq(dessertsTable.enabled, true),
				),
			);

		// Build modifier map for quick lookup
		const modifierMap = new Map(modifierDesserts.map((m) => [m.id, m]));

		for (const requested of requestedModifiers) {
			const dessert = modifierMap.get(requested.dessertId);
			if (!dessert) {
				return {
					success: false,
					error: `Modifier dessert not found or disabled (ID: ${requested.dessertId})`,
				};
			}
			modifiers.push({
				dessertId: dessert.id,
				name: dessert.name,
				price: dessert.price,
				quantity: requested.quantity,
			});
		}
	}

	// Compute unit price (no override for variants)
	const unitPrice = computeUnitPrice(baseDessert.price, modifiers, null);

	const cartLine: CartLine = {
		cartLineId: generateCartLineId(),
		baseDessertId: baseDessert.id,
		baseDessertName: baseDessert.name,
		baseDessertPrice: baseDessert.price,
		hasUnlimitedStock: baseDessert.hasUnlimitedStock,
		modifiers,
		unitPrice,
		quantity,
	};

	return { success: true, cartLine };
}

/**
 * Resolves a simple base dessert selection (no modifiers) into a cart line.
 * Convenience wrapper around resolveVariant.
 */
export async function resolveBaseDessert(
	baseDessertId: number,
	quantity: number,
): Promise<ResolveResult> {
	return resolveVariant({
		baseDessertId,
		modifiers: [],
		quantity,
	});
}

// ============================================================================
// Pricing
// ============================================================================

/**
 * Computes unit price for a cart line.
 * If overridePrice is set, use it. Otherwise: base + sum(modifier price × quantity)
 */
function computeUnitPrice(
	basePrice: number,
	modifiers: CartLineModifier[],
	overridePrice: number | null,
): number {
	if (overridePrice !== null) {
		return overridePrice;
	}

	const modifierTotal = modifiers.reduce(
		(sum, mod) => sum + mod.price * mod.quantity,
		0,
	);

	return basePrice + modifierTotal;
}

// ============================================================================
// Inventory Validation
// ============================================================================

/**
 * Validates that sufficient inventory exists for a base dessert.
 * Only called for desserts without unlimited stock.
 */
async function validateBaseInventory(
	baseDessertId: number,
	quantity: number,
): Promise<{ success: true } | ResolutionError> {
	const day = getStartOfDay();

	const [inventory] = await db
		.select({ quantity: dailyDessertInventoryTable.quantity })
		.from(dailyDessertInventoryTable)
		.where(
			and(
				eq(dailyDessertInventoryTable.dessertId, baseDessertId),
				eq(dailyDessertInventoryTable.day, day),
			),
		);

	const available = inventory?.quantity ?? 0;

	if (available < quantity) {
		return {
			success: false,
			error: `Insufficient stock. Available: ${available}, Requested: ${quantity}`,
		};
	}

	return { success: true };
}

// ============================================================================
// Combo Fetching (for UI)
// ============================================================================

/**
 * Fetches all enabled combos with their details for UI display.
 */
export async function getEnabledCombos(): Promise<ComboWithDetails[]> {
	const combos = await db.query.dessertCombosTable.findMany({
		where: and(
			eq(dessertCombosTable.isDeleted, false),
			eq(dessertCombosTable.enabled, true),
		),
		orderBy: (combos, { asc }) => [asc(combos.sequence)],
		with: {
			baseDessert: {
				columns: {
					id: true,
					name: true,
					price: true,
					hasUnlimitedStock: true,
				},
			},
			items: {
				with: {
					dessert: {
						columns: {
							id: true,
							name: true,
							price: true,
						},
					},
				},
			},
		},
	});

	return combos as ComboWithDetails[];
}

/**
 * Fetches all modifier desserts for variant building UI.
 */
export async function getModifierDesserts() {
	return db.query.dessertsTable.findMany({
		where: and(
			eq(dessertsTable.isDeleted, false),
			eq(dessertsTable.enabled, true),
			eq(dessertsTable.kind, "modifier"),
		),
		orderBy: (desserts, { asc }) => [asc(desserts.sequence)],
		columns: {
			id: true,
			name: true,
			price: true,
		},
	});
}

/**
 * Fetches all base desserts for variant building UI.
 */
export async function getBaseDesserts() {
	return db.query.dessertsTable.findMany({
		where: and(
			eq(dessertsTable.isDeleted, false),
			eq(dessertsTable.enabled, true),
			eq(dessertsTable.kind, "base"),
		),
		orderBy: (desserts, { asc }) => [asc(desserts.sequence)],
	});
}
