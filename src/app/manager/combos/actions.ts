"use server";

import {
	createCombo as createManagerCombo,
	deleteCombo as deleteManagerCombo,
	getCachedAllCombos as getCachedAllManagerCombos,
	getCachedBaseDesserts as getCachedManagerBaseDesserts,
	getCachedModifierDesserts as getCachedManagerModifierDesserts,
	toggleCombo as toggleManagerCombo,
	updateCombo as updateManagerCombo,
	updateComboItems as updateManagerComboItems,
} from "@/lib/role-actions/manager-combos";

type CreateComboData = Parameters<typeof createManagerCombo>[0];
type UpdateComboId = Parameters<typeof updateManagerCombo>[0];
type UpdateComboData = Parameters<typeof updateManagerCombo>[1];
type DeleteComboId = Parameters<typeof deleteManagerCombo>[0];
type ToggleComboId = Parameters<typeof toggleManagerCombo>[0];
type ToggleComboEnabled = Parameters<typeof toggleManagerCombo>[1];
type UpdateComboItemsId = Parameters<typeof updateManagerComboItems>[0];
type UpdateComboItemsData = Parameters<typeof updateManagerComboItems>[1];

export async function getCachedAllCombos() {
	return getCachedAllManagerCombos();
}

export async function getCachedBaseDesserts() {
	return getCachedManagerBaseDesserts();
}

export async function getCachedModifierDesserts() {
	return getCachedManagerModifierDesserts();
}

export async function createCombo(data: CreateComboData) {
	return createManagerCombo(data);
}

export async function updateCombo(id: UpdateComboId, data: UpdateComboData) {
	return updateManagerCombo(id, data);
}

export async function deleteCombo(id: DeleteComboId) {
	return deleteManagerCombo(id);
}

export async function toggleCombo(id: ToggleComboId, enabled: ToggleComboEnabled) {
	return toggleManagerCombo(id, enabled);
}

export async function updateComboItems(comboId: UpdateComboItemsId, items: UpdateComboItemsData) {
	return updateManagerComboItems(comboId, items);
}
