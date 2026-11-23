"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { CheckoutUpiAccount } from "@/features/upi/shapes";

const useUpiSelectionStore = create<{ selectedId: string | null; select: (id: string) => void }>()(
	persist((set) => ({ selectedId: null, select: (id) => set({ selectedId: id }) }), {
		name: "cocoacomaa-selected-upi-id",
		version: 1,
		// Version 0 stored `selectedUpiId`, which defaulted to "1" from before account ids were UUIDs.
		migrate: (persisted) => {
			const { selectedUpiId } = (persisted ?? {}) as { selectedUpiId?: unknown };
			return { selectedId: typeof selectedUpiId === "string" ? selectedUpiId : null };
		},
	}),
);

/** The account this device last chose for payment, or the first one when that choice is gone. Remembered per device. */
export function useSelectedUpiAccount(accounts: readonly CheckoutUpiAccount[]) {
	const { selectedId, select } = useUpiSelectionStore();
	const selected = accounts.find((account) => account.id === selectedId) ?? accounts[0];
	return { selected, select };
}
