"use server";

import {
	createCombo as createAdminCombo,
	deleteCombo as deleteAdminCombo,
	getCachedBaseDesserts as getCachedAdminBaseDesserts,
	getCachedModifierDesserts as getCachedAdminModifierDesserts,
	getCachedAllCombos as getCachedAllAdminCombos,
	toggleCombo as toggleAdminCombo,
	updateCombo as updateAdminCombo,
	updateComboItems as updateAdminComboItems,
} from "@/lib/role-actions/admin-combos";

type CreateComboData = Parameters<typeof createAdminCombo>[0];
type UpdateComboId = Parameters<typeof updateAdminCombo>[0];
type UpdateComboData = Parameters<typeof updateAdminCombo>[1];
type DeleteComboId = Parameters<typeof deleteAdminCombo>[0];
type ToggleComboId = Parameters<typeof toggleAdminCombo>[0];
type ToggleComboEnabled = Parameters<typeof toggleAdminCombo>[1];
type UpdateComboItemsId = Parameters<typeof updateAdminComboItems>[0];
type UpdateComboItemsData = Parameters<typeof updateAdminComboItems>[1];

export async function getCachedAllCombos() {
	return getCachedAllAdminCombos();
}

export async function getCachedBaseDesserts() {
	return getCachedAdminBaseDesserts();
}

export async function getCachedModifierDesserts() {
	return getCachedAdminModifierDesserts();
}

export async function createCombo(data: CreateComboData) {
	return createAdminCombo(data);
}

export async function updateCombo(id: UpdateComboId, data: UpdateComboData) {
	return updateAdminCombo(id, data);
}

export async function deleteCombo(id: DeleteComboId) {
	return deleteAdminCombo(id);
}

export async function toggleCombo(id: ToggleComboId, enabled: ToggleComboEnabled) {
	return toggleAdminCombo(id, enabled);
}

export async function updateComboItems(comboId: UpdateComboItemsId, items: UpdateComboItemsData) {
	return updateAdminComboItems(comboId, items);
}
