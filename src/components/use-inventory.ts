"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import type { InventoryUpdate, InventoryWriteResult } from "@/lib/daily-inventory";
import type { Dessert } from "@/lib/types";

type TodayInventoryRow = {
	dessertId: number;
	quantity: number;
};

function toInventoryMap(rows: TodayInventoryRow[]) {
	return new Map(rows.map((r) => [r.dessertId, r.quantity] as const));
}

type UseInventoryOptions = {
	desserts: Dessert[];
	initialInventory: TodayInventoryRow[];
	onSave: (updates: InventoryUpdate[]) => Promise<InventoryWriteResult>;
	onRefetch: () => Promise<{
		desserts: Dessert[];
		inventory: TodayInventoryRow[];
	}>;
};

type InventoryDessert = Pick<Dessert, "id" | "enabled" | "hasUnlimitedStock">;

function parseInventoryQuantity(value: string | undefined) {
	if (value === undefined || value.trim() === "") return Number.NaN;
	return Number(value);
}

export function buildDirtyInventoryUpdates(
	desserts: InventoryDessert[],
	quantities: Record<number, string>,
	serverQuantities: Map<number, number>,
): InventoryUpdate[] {
	return desserts.flatMap((dessert) => {
		if (!dessert.enabled || dessert.hasUnlimitedStock) return [];

		const expectedQuantity = serverQuantities.get(dessert.id) ?? 0;
		const quantity = parseInventoryQuantity(quantities[dessert.id]);
		if (quantity === expectedQuantity) return [];

		return [{ dessertId: dessert.id, expectedQuantity, quantity }];
	});
}

export function useInventory({ desserts, initialInventory, onSave, onRefetch }: UseInventoryOptions) {
	const initialInventoryMap = useMemo(() => toInventoryMap(initialInventory), [initialInventory]);

	// Track the original quantities from the server
	const [serverQuantities, setServerQuantities] = useState<Map<number, number>>(() => new Map(initialInventoryMap));

	const [quantities, setQuantities] = useState<Record<number, string>>(() => {
		const initial: Record<number, string> = {};
		for (const dessert of desserts) {
			initial[dessert.id] = String(initialInventoryMap.get(dessert.id) ?? 0);
		}
		return initial;
	});

	const [isSaving, setIsSaving] = useState(false);

	const dirtyUpdates = useMemo(
		() => buildDirtyInventoryUpdates(desserts, quantities, serverQuantities),
		[desserts, quantities, serverQuantities],
	);
	const changedDessertIds = useMemo(() => new Set(dirtyUpdates.map(({ dessertId }) => dessertId)), [dirtyUpdates]);

	const hasChanges = changedDessertIds.size > 0;

	const todayLabel = useMemo(
		() =>
			new Date().toLocaleDateString("en-IN", {
				year: "numeric",
				month: "short",
				day: "numeric",
			}),
		[],
	);

	const onQuantityChange = useCallback((dessertId: number, value: string) => {
		setQuantities((prev) => ({
			...prev,
			[dessertId]: value,
		}));
	}, []);

	const refreshInventoryState = useCallback((newDesserts: Dessert[], newInventory: TodayInventoryRow[]) => {
		const newMap = toInventoryMap(newInventory);
		setServerQuantities(new Map(newMap));
		setQuantities((prev) => {
			const next: Record<number, string> = { ...prev };
			for (const dessert of newDesserts) {
				next[dessert.id] = String(newMap.get(dessert.id) ?? 0);
			}
			return next;
		});
	}, []);

	const handleSaveInventory = useCallback(async () => {
		if (!hasChanges) {
			toast.info("No changes to save");
			return;
		}

		setIsSaving(true);
		try {
			let result: InventoryWriteResult;
			try {
				result = await onSave(dirtyUpdates);
			} catch (error) {
				console.error(error);
				toast.error("Failed to save inventory");
				return;
			}

			try {
				const { desserts: newDesserts, inventory: newInventory } = await onRefetch();
				refreshInventoryState(newDesserts, newInventory);
			} catch (error) {
				console.error(error);
				toast.error(
					result.ok
						? "Inventory saved, but the latest stock could not be loaded. Refresh to verify current inventory."
						: "Inventory conflict detected. Refresh to load the latest stock, then review and save again.",
				);
				return;
			}

			if (result.ok) {
				toast.success(`Inventory saved (${dirtyUpdates.length} item${dirtyUpdates.length !== 1 ? "s" : ""} updated)`);
			} else {
				toast.error("Inventory changed while you were editing. Latest stock was loaded; review and save again.");
			}
		} finally {
			setIsSaving(false);
		}
	}, [hasChanges, dirtyUpdates, onSave, onRefetch, refreshInventoryState]);

	return {
		quantities,
		serverQuantities,
		changedDessertIds,
		hasChanges,
		onQuantityChange,
		onSaveInventory: handleSaveInventory,
		isSaving,
		todayLabel,
		refreshInventoryState,
	};
}
