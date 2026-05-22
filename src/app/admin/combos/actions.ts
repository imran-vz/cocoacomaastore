"use server";

import { requireAdmin } from "@/lib/auth/guards";
import {
	type BaseDessert,
	createCombo as createComboCore,
	deleteCombo as deleteComboCore,
	getCachedAllCombos,
	getCachedBaseDesserts,
	getCachedModifierDesserts,
	type ModifierDessert,
	toggleCombo as toggleComboCore,
	updateCombo as updateComboCore,
	updateComboItems as updateComboItemsCore,
} from "@/lib/combo-service";

export { getCachedAllCombos, getCachedBaseDesserts, getCachedModifierDesserts };
export type { BaseDessert, ModifierDessert };

export async function createCombo(data: {
	name: string;
	baseDessertId: number;
	overridePrice?: number | null;
	enabled?: boolean;
}) {
	await requireAdmin();
	return createComboCore(data);
}

export async function updateCombo(
	id: number,
	data: {
		name: string;
		baseDessertId: number;
		overridePrice: number | null;
		enabled: boolean;
	},
) {
	await requireAdmin();
	return updateComboCore(id, data);
}

export async function deleteCombo(id: number) {
	await requireAdmin();
	return deleteComboCore(id);
}

export async function toggleCombo(id: number, enabled: boolean) {
	await requireAdmin();
	return toggleComboCore(id, enabled);
}

export async function updateComboItems(comboId: number, items: Array<{ dessertId: number; quantity: number }>) {
	await requireAdmin();
	return updateComboItemsCore(comboId, items);
}
