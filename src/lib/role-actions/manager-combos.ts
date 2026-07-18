"use server";

// Next.js requires each "use server" module to export its actions as top-level
// async functions, so the admin and manager variants repeat the same wrapper
// shape around createComboActions; the guard passed to the factory is the only
// difference.
// fallow-ignore-file code-duplication

import { requireManagerAccess } from "@/lib/auth/guards";
import { createComboActions } from "./combo-actions";

const actions = createComboActions({ requireUser: requireManagerAccess });

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
