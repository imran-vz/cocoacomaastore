import { toast } from "sonner";
import { create } from "zustand";
import type { ComboWithDetails } from "@/lib/types";

export interface BaseDessertOption {
	id: number;
	name: string;
	price: number;
	hasUnlimitedStock: boolean;
}

export interface ModifierDessertOption {
	id: number;
	name: string;
	price: number;
}

export interface ComboFormData {
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

	handleSubmit: () => Promise<void>;
	handleDelete: () => Promise<void>;
	handleToggle: (combo: ComboWithDetails) => Promise<void>;
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
		if (!actions) return;

		if (!formData.name.trim()) {
			toast.error("Name is required");
			return;
		}
		if (!formData.baseDessertId) {
			toast.error("Base dessert is required");
			return;
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
			set({
				combos: updated,
				openModal: false,
				editingCombo: null,
				formData: initialFormData,
			});
			toast.success(editingCombo ? "Combo updated" : "Combo created");
		} catch (error) {
			console.error("Failed to save combo:", error);
			toast.error("Failed to save combo");
		} finally {
			set({ isLoading: false });
		}
	},

	handleDelete: async () => {
		const { editingCombo, actions } = get();
		if (!editingCombo || !actions) return;

		set({ isLoading: true });
		try {
			await actions.deleteCombo(editingCombo.id);
			const updated = await actions.refetchCombos();
			set({
				combos: updated,
				openModal: false,
				editingCombo: null,
				formData: initialFormData,
			});
			toast.success("Combo deleted");
		} catch (error) {
			console.error("Failed to delete combo:", error);
			toast.error("Failed to delete combo");
		} finally {
			set({ isLoading: false });
		}
	},

	handleToggle: async (combo) => {
		const { actions } = get();
		if (!actions) return;

		const newEnabled = !combo.enabled;

		set((state) => ({
			toggleLoadingIds: new Set(state.toggleLoadingIds).add(combo.id),
			combos: state.combos.map((c) => (c.id === combo.id ? { ...c, enabled: newEnabled } : c)),
		}));

		try {
			await actions.toggleCombo(combo.id, newEnabled);
			const updated = await actions.refetchCombos();
			set({ combos: updated });
			toast.success(`Combo ${newEnabled ? "enabled" : "disabled"}`);
		} catch (error) {
			console.error("Failed to toggle combo:", error);
			toast.error("Failed to toggle combo");
			set((state) => ({
				combos: state.combos.map((c) => (c.id === combo.id ? { ...c, enabled: combo.enabled } : c)),
			}));
		} finally {
			set((state) => {
				const next = new Set(state.toggleLoadingIds);
				next.delete(combo.id);
				return { toggleLoadingIds: next };
			});
		}
	},
}));
