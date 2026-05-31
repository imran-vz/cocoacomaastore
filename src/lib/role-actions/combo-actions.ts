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

type RoleActionConfig = {
	requireUser: () => Promise<unknown>;
};

export function createComboActions({ requireUser }: RoleActionConfig) {
	return {
		async getCachedAllCombos() {
			return getCachedAllCombosCore();
		},

		async getCachedBaseDesserts() {
			return getCachedBaseDessertsCore();
		},

		async getCachedModifierDesserts() {
			return getCachedModifierDessertsCore();
		},

		async createCombo(data: Parameters<typeof createComboCore>[0]) {
			await requireUser();
			return createComboCore(data);
		},

		async updateCombo(id: Parameters<typeof updateComboCore>[0], data: Parameters<typeof updateComboCore>[1]) {
			await requireUser();
			return updateComboCore(id, data);
		},

		async deleteCombo(id: Parameters<typeof deleteComboCore>[0]) {
			await requireUser();
			return deleteComboCore(id);
		},

		async toggleCombo(id: Parameters<typeof toggleComboCore>[0], enabled: Parameters<typeof toggleComboCore>[1]) {
			await requireUser();
			return toggleComboCore(id, enabled);
		},

		async updateComboItems(
			comboId: Parameters<typeof updateComboItemsCore>[0],
			items: Parameters<typeof updateComboItemsCore>[1],
		) {
			await requireUser();
			return updateComboItemsCore(comboId, items);
		},
	};
}
