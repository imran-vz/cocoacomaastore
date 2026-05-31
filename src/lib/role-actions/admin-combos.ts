"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { createComboActions } from "./combo-actions";

const actions = createComboActions({ requireUser: requireAdmin });

export async function getCachedAllCombos() {
	return actions.getCachedAllCombos();
}

export async function getCachedBaseDesserts() {
	return actions.getCachedBaseDesserts();
}

export async function getCachedModifierDesserts() {
	return actions.getCachedModifierDesserts();
}

export async function createCombo(data: Parameters<typeof actions.createCombo>[0]) {
	return actions.createCombo(data);
}

export async function updateCombo(
	id: Parameters<typeof actions.updateCombo>[0],
	data: Parameters<typeof actions.updateCombo>[1],
) {
	return actions.updateCombo(id, data);
}

export async function deleteCombo(id: Parameters<typeof actions.deleteCombo>[0]) {
	return actions.deleteCombo(id);
}

export async function toggleCombo(
	id: Parameters<typeof actions.toggleCombo>[0],
	enabled: Parameters<typeof actions.toggleCombo>[1],
) {
	return actions.toggleCombo(id, enabled);
}

export async function updateComboItems(
	comboId: Parameters<typeof actions.updateComboItems>[0],
	items: Parameters<typeof actions.updateComboItems>[1],
) {
	return actions.updateComboItems(comboId, items);
}
