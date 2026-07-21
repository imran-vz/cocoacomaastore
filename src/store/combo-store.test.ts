import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComboWithDetails } from "@/lib/types";
import { type ComboActions, useComboStore } from "./combo-store";

const combo = {
	id: 1,
	name: "Brownie combo",
	baseDessertId: 10,
	overridePrice: null,
	enabled: true,
	isDeleted: false,
	baseDessert: { id: 10, name: "Brownie", price: 100, hasUnlimitedStock: false },
	items: [],
} as unknown as ComboWithDetails;

function createActions(overrides: Partial<ComboActions> = {}): ComboActions {
	return {
		createCombo: vi.fn().mockResolvedValue({ id: 2 }),
		updateCombo: vi.fn().mockResolvedValue(undefined),
		deleteCombo: vi.fn().mockResolvedValue(undefined),
		toggleCombo: vi.fn().mockResolvedValue(undefined),
		updateComboItems: vi.fn().mockResolvedValue(undefined),
		refetchCombos: vi.fn().mockResolvedValue([combo]),
		...overrides,
	};
}

beforeEach(() => {
	useComboStore.setState({
		combos: [],
		bases: [],
		modifiers: [],
		actions: null,
		openModal: false,
		editingCombo: null,
		formData: { name: "", baseDessertId: null, overridePrice: "", enabled: true, items: [] },
		isLoading: false,
		searchTerm: "",
		toggleLoadingIds: new Set(),
	});
});

describe("combo store outcomes", () => {
	it("returns a create outcome without closing or resetting the form", async () => {
		const actions = createActions();
		const store = useComboStore.getState();
		store.init([], [combo.baseDessert], [], actions);
		store.openCreateModal();
		useComboStore.getState().setFormField({ name: "New combo", baseDessertId: combo.baseDessertId });

		await expect(useComboStore.getState().handleSubmit()).resolves.toEqual({ ok: true, mode: "created" });
		expect(useComboStore.getState()).toMatchObject({
			openModal: true,
			formData: { name: "New combo", baseDessertId: combo.baseDessertId },
		});
		expect(actions.createCombo).toHaveBeenCalledOnce();
	});

	it("returns a delete outcome and closes the dialog when the combo is removed", async () => {
		const actions = createActions({ refetchCombos: vi.fn().mockResolvedValue([]) });
		useComboStore.getState().init([combo], [combo.baseDessert], [], actions);
		useComboStore.getState().openEditModal(combo);

		await expect(useComboStore.getState().handleDelete()).resolves.toEqual({ ok: true });
		expect(useComboStore.getState()).toMatchObject({
			openModal: false,
			editingCombo: null,
			combos: [],
		});
		expect(actions.deleteCombo).toHaveBeenCalledOnce();
	});

	it("returns a failed delete outcome and keeps the dialog open", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const actions = createActions({ deleteCombo: vi.fn().mockRejectedValue(new Error("offline")) });
		useComboStore.getState().init([combo], [combo.baseDessert], [], actions);
		useComboStore.getState().openEditModal(combo);

		await expect(useComboStore.getState().handleDelete()).resolves.toEqual({ ok: false });
		expect(useComboStore.getState()).toMatchObject({ openModal: true, isLoading: false });
		expect(useComboStore.getState().editingCombo?.id).toBe(combo.id);
		errorSpy.mockRestore();
	});

	it("returns a failed toggle outcome and rolls back the optimistic state", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const actions = createActions({ toggleCombo: vi.fn().mockRejectedValue(new Error("offline")) });
		useComboStore.getState().init([combo], [combo.baseDessert], [], actions);

		await expect(useComboStore.getState().handleToggle(combo)).resolves.toEqual({ ok: false });
		expect(useComboStore.getState().combos[0]?.enabled).toBe(true);
		expect(useComboStore.getState().toggleLoadingIds.size).toBe(0);
		errorSpy.mockRestore();
	});
});
