"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Dessert } from "@/lib/types";

export type TodayInventoryRow = {
	dessertId: number;
	quantity: number;
};

function toInventoryMap(rows: TodayInventoryRow[]) {
	return new Map(rows.map((r) => [r.dessertId, r.quantity] as const));
}

type UseInventoryOptions = {
	desserts: Dessert[];
	initialInventory: TodayInventoryRow[];
	onSave: (
		updates: Array<{ dessertId: number; quantity: number }>,
	) => Promise<void>;
	onRefetch: () => Promise<{
		desserts: Dessert[];
		inventory: TodayInventoryRow[];
	}>;
};

export function useInventory({
	desserts,
	initialInventory,
	onSave,
	onRefetch,
}: UseInventoryOptions) {
	const initialInventoryMap = useMemo(
		() => toInventoryMap(initialInventory),
		[initialInventory],
	);

	// Track the original quantities from the server
	const [serverQuantities, setServerQuantities] = useState<Map<number, number>>(
		() => new Map(initialInventoryMap),
	);

	const [quantities, setQuantities] = useState<Record<number, string>>(() => {
		const initial: Record<number, string> = {};
		for (const dessert of desserts) {
			initial[dessert.id] = String(initialInventoryMap.get(dessert.id) ?? 0);
		}
		return initial;
	});

	const [isSaving, setIsSaving] = useState(false);

	// Track which quantities have changed from the server state
	const changedDessertIds = useMemo(() => {
		const changed = new Set<number>();
		for (const dessert of desserts) {
			if (!dessert.enabled || dessert.hasUnlimitedStock) continue;
			const currentQty = Number.parseInt(quantities[dessert.id] ?? "0", 10);
			const serverQty = serverQuantities.get(dessert.id) ?? 0;
			if (currentQty !== serverQty) {
				changed.add(dessert.id);
			}
		}
		return changed;
	}, [desserts, quantities, serverQuantities]);

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

	const refreshInventoryState = useCallback(
		(newDesserts: Dessert[], newInventory: TodayInventoryRow[]) => {
			const newMap = toInventoryMap(newInventory);
			setServerQuantities(new Map(newMap));
			setQuantities((prev) => {
				const next: Record<number, string> = { ...prev };
				for (const dessert of newDesserts) {
					next[dessert.id] = String(newMap.get(dessert.id) ?? 0);
				}
				return next;
			});
		},
		[],
	);

	const handleSaveInventory = useCallback(async () => {
		if (!hasChanges) {
			toast.info("No changes to save");
			return;
		}

		try {
			setIsSaving(true);

			// Only send desserts that have changed quantities
			const updates = desserts
				.filter(
					(d) =>
						d.enabled && !d.hasUnlimitedStock && changedDessertIds.has(d.id),
				)
				.map((d) => ({
					dessertId: d.id,
					quantity: Number.parseInt(quantities[d.id] ?? "0", 10),
				}));

			if (updates.length > 0) {
				await onSave(updates);
			}

			const { desserts: newDesserts, inventory: newInventory } =
				await onRefetch();
			refreshInventoryState(newDesserts, newInventory);

			toast.success(
				`Inventory saved (${updates.length} item${updates.length !== 1 ? "s" : ""} updated)`,
			);
		} catch (error) {
			console.error(error);
			toast.error("Failed to save inventory");
		} finally {
			setIsSaving(false);
		}
	}, [
		hasChanges,
		desserts,
		changedDessertIds,
		quantities,
		onSave,
		onRefetch,
		refreshInventoryState,
	]);

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
