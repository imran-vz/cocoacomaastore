import { create } from "zustand";
import type { ComboWithDetails } from "@/lib/types";

interface BaseDessertOption {
	id: number;
	name: string;
	price: number;
	hasUnlimitedStock: boolean;
}

interface ModifierDessertOption {
	id: number;
	name: string;
	price: number;
}

interface ComboFormData {
	name: string;
	baseDessertId: number | null;
	overridePrice: string;
	enabled: boolean;
	items: Array<{ dessertId: number; quantity: number }>;
}

export interface ComboActions {
	createCombo: (data: {
		name: string;
		baseDessertId: number;
		overridePrice?: number | null;
		enabled?: boolean;
	}) => Promise<{ id: number }>;
	updateCombo: (
		id: number,
		data: {
			name: string;
			baseDessertId: number;
			overridePrice: number | null;
			enabled: boolean;
		},
	) => Promise<void>;
	deleteCombo: (id: number) => Promise<void>;
	toggleCombo: (id: number, enabled: boolean) => Promise<void>;
	updateComboItems: (comboId: number, items: Array<{ dessertId: number; quantity: number }>) => Promise<void>;
	refetchCombos: () => Promise<ComboWithDetails[]>;
}

const initialFormData: ComboFormData = {
	name: "",
	baseDessertId: null,
	overridePrice: "",
	enabled: true,
	items: [],
};

export type ComboSubmitResult = { ok: true; mode: "created" | "updated" } | { ok: false };
export type ComboDeleteResult = { ok: true } | { ok: false };
export type ComboToggleResult = { ok: true; enabled: boolean } | { ok: false };

interface ComboStore {
	combos: ComboWithDetails[];
	bases: BaseDessertOption[];
	modifiers: ModifierDessertOption[];
	actions: ComboActions | null;

	openModal: boolean;
	editingCombo: ComboWithDetails | null;
	formData: ComboFormData;
	isLoading: boolean;
	searchTerm: string;
	toggleLoadingIds: Set<number>;

	init: (
		combos: ComboWithDetails[],
		bases: BaseDessertOption[],
		modifiers: ModifierDessertOption[],
		actions: ComboActions,
	) => void;
	setCombos: (combos: ComboWithDetails[]) => void;
	setSearchTerm: (term: string) => void;

	openCreateModal: () => void;
	openEditModal: (combo: ComboWithDetails) => void;
	closeModal: () => void;
	setFormField: (updates: Partial<ComboFormData>) => void;
	toggleModifier: (dessertId: number) => void;
	updateModifierQuantity: (dessertId: number, quantity: number) => void;

	handleSubmit: () => Promise<ComboSubmitResult>;
	handleDelete: () => Promise<ComboDeleteResult>;
	handleToggle: (combo: ComboWithDetails) => Promise<ComboToggleResult>;
}

export const useComboStore = create<ComboStore>((set, get) => ({
	combos: [],
	bases: [],
	modifiers: [],
	actions: null,

	openModal: false,
	editingCombo: null,
	formData: initialFormData,
	isLoading: false,
	searchTerm: "",
	toggleLoadingIds: new Set(),

	init: (combos, bases, modifiers, actions) => {
		const basesById = new Map(bases.map((b) => [b.id, b]));
		for (const combo of combos) {
			if (!basesById.has(combo.baseDessertId)) {
				basesById.set(combo.baseDessertId, combo.baseDessert);
			}
		}
		set({
			combos,
			bases: Array.from(basesById.values()),
			modifiers,
			actions,
		});
	},

	setCombos: (combos) => set({ combos }),
	setSearchTerm: (term) => set({ searchTerm: term }),

	openCreateModal: () =>
		set({
			editingCombo: null,
			formData: initialFormData,
			openModal: true,
		}),

	openEditModal: (combo) =>
		set({
			editingCombo: combo,
			formData: {
				name: combo.name,
				baseDessertId: combo.baseDessertId,
				overridePrice: combo.overridePrice?.toString() ?? "",
				enabled: combo.enabled,
				items: combo.items.map((item) => ({
					dessertId: item.dessertId,
					quantity: item.quantity,
				})),
			},
			openModal: true,
		}),

	closeModal: () =>
		set({
			openModal: false,
			editingCombo: null,
			formData: initialFormData,
		}),

	setFormField: (updates) =>
		set((state) => ({
			formData: { ...state.formData, ...updates },
		})),

	toggleModifier: (dessertId) =>
		set((state) => {
			const existing = state.formData.items.find((i) => i.dessertId === dessertId);
			return {
				formData: {
					...state.formData,
					items: existing
						? state.formData.items.filter((i) => i.dessertId !== dessertId)
						: [...state.formData.items, { dessertId, quantity: 1 }],
				},
			};
		}),

	updateModifierQuantity: (dessertId, quantity) => {
		if (quantity < 1) return;
		set((state) => ({
			formData: {
				...state.formData,
				items: state.formData.items.map((item) => (item.dessertId === dessertId ? { ...item, quantity } : item)),
			},
		}));
	},

	handleSubmit: async () => {
		const { formData, editingCombo, actions } = get();
		if (!actions) return { ok: false };

		// The dialog validates and surfaces field-level messages on the submit button
		// before entering loading; these guards stay as a defensive net (and to narrow
		// baseDessertId to a number) but no longer surface toasts.
		if (!formData.name.trim() || !formData.baseDessertId) {
			return { ok: false };
		}

		set({ isLoading: true });
		try {
			const overridePrice = formData.overridePrice ? Number.parseInt(formData.overridePrice, 10) : null;

			if (editingCombo) {
				await actions.updateCombo(editingCombo.id, {
					name: formData.name.trim(),
					baseDessertId: formData.baseDessertId,
					overridePrice,
					enabled: formData.enabled,
				});
				await actions.updateComboItems(editingCombo.id, formData.items);
			} else {
				const newCombo = await actions.createCombo({
					name: formData.name.trim(),
					baseDessertId: formData.baseDessertId,
					overridePrice,
					enabled: formData.enabled,
				});
				if (formData.items.length > 0) {
					await actions.updateComboItems(newCombo.id, formData.items);
				}
			}

			const updated = await actions.refetchCombos();
			set({ combos: updated });
			return { ok: true, mode: editingCombo ? "updated" : "created" };
		} catch (error) {
			console.error("Failed to save combo:", error);
			return { ok: false };
		} finally {
			set({ isLoading: false });
		}
	},

	handleDelete: async (): Promise<ComboDeleteResult> => {
		const { editingCombo, actions } = get();
		if (!editingCombo || !actions) return { ok: false };

		set({ isLoading: true });
		try {
			await actions.deleteCombo(editingCombo.id);
			const updated = await actions.refetchCombos();
			// Success feedback is the combo leaving the list and the dialog closing —
			// no toast or on-button flash needed.
			set({
				combos: updated,
				openModal: false,
				editingCombo: null,
				formData: initialFormData,
			});
			return { ok: true };
		} catch (error) {
			console.error("Failed to delete combo:", error);
			return { ok: false };
		} finally {
			set({ isLoading: false });
		}
	},

	handleToggle: async (combo) => {
		const { actions } = get();
		if (!actions) return { ok: false };

		const newEnabled = !combo.enabled;

		set((state) => ({
			toggleLoadingIds: new Set(state.toggleLoadingIds).add(combo.id),
			combos: state.combos.map((c) => (c.id === combo.id ? { ...c, enabled: newEnabled } : c)),
		}));

		try {
			await actions.toggleCombo(combo.id, newEnabled);
			const updated = await actions.refetchCombos();
			set({ combos: updated });
			return { ok: true, enabled: newEnabled };
		} catch (error) {
			console.error("Failed to toggle combo:", error);
			set((state) => ({
				combos: state.combos.map((c) => (c.id === combo.id ? { ...c, enabled: combo.enabled } : c)),
			}));
			return { ok: false };
		} finally {
			set((state) => {
				const next = new Set(state.toggleLoadingIds);
				next.delete(combo.id);
				return { toggleLoadingIds: next };
			});
		}
	},
}));
