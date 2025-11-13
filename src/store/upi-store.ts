import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UpiStore {
	selectedUpiId: string;
	setSelectedUpiId: (id: string) => void;
}

export const useUpiStore = create<UpiStore>()(
	persist(
		(set) => ({
			selectedUpiId: "1",
			setSelectedUpiId: (id) => set({ selectedUpiId: id }),
		}),
		{
			name: "cocoacomaa-selected-upi-id",
		},
	),
);
