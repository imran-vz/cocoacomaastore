"use server";

import { requireAdmin } from "@/lib/auth/guards";
import {
	createCombo as createComboCore,
	deleteCombo as deleteComboCore,
	getCachedAllCombos as getCachedAllCombosCore,
	getCachedBaseDesserts as getCachedBaseDessertsCore,
	getCachedModifierDesserts as getCachedModifierDessertsCore,
	toggleCombo as toggleComboCore,
	updateCombo as updateComboCore,
	updateComboItems as updateComboItemsCore,
} from "@/lib/combo-service";

export async function getCachedAllCombos() {
	return getCachedAllCombosCore();
}

export async function getCachedBaseDesserts() {
	return getCachedBaseDessertsCore();
}

export async function getCachedModifierDesserts() {
	return getCachedModifierDessertsCore();
}

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
