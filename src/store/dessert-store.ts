import { create } from "zustand";
import type { Dessert } from "@/lib/types";

interface DessertStore {
	searchQuery: string;
	isEditMode: boolean;
	localDesserts: Dessert[];
	hasUnsavedChanges: boolean;
	stockToggleLoadingIds: Set<number>;
	setSearchQuery: (query: string) => void;
	setIsEditMode: (mode: boolean) => void;
	clearSearch: () => void;
	setLocalDesserts: (desserts: Dessert[]) => void;
	setHasUnsavedChanges: (hasChanges: boolean) => void;
	updateDessert: (id: number, updates: Partial<Dessert>) => void;
	reorderDesserts: (desserts: Dessert[]) => void;
	addStockToggleLoadingId: (id: number) => void;
	removeStockToggleLoadingId: (id: number) => void;
	reset: () => void;
}

export const useDessertStore = create<DessertStore>((set) => ({
	searchQuery: "",
	isEditMode: false,
	localDesserts: [],
	hasUnsavedChanges: false,
	stockToggleLoadingIds: new Set(),
	setSearchQuery: (query) => set({ searchQuery: query }),
	setIsEditMode: (mode) => set({ isEditMode: mode }),
	clearSearch: () => set({ searchQuery: "" }),
	setLocalDesserts: (desserts) =>
		set({ localDesserts: desserts, hasUnsavedChanges: false }),
	setHasUnsavedChanges: (hasChanges) => set({ hasUnsavedChanges: hasChanges }),
	updateDessert: (id, updates) =>
		set((state) => ({
			localDesserts: state.localDesserts.map((d) =>
				d.id === id ? { ...d, ...updates } : d,
			),
		})),
	reorderDesserts: (desserts) =>
		set({ localDesserts: desserts, hasUnsavedChanges: true }),
	addStockToggleLoadingId: (id) =>
		set((state) => ({
			stockToggleLoadingIds: new Set(state.stockToggleLoadingIds).add(id),
		})),
	removeStockToggleLoadingId: (id) =>
		set((state) => {
			const newSet = new Set(state.stockToggleLoadingIds);
			newSet.delete(id);
			return { stockToggleLoadingIds: newSet };
		}),
	reset: () =>
		set({
			searchQuery: "",
			isEditMode: false,
			hasUnsavedChanges: false,
			stockToggleLoadingIds: new Set(),
		}),
}));
