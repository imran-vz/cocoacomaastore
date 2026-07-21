"use client";

import { useQuery } from "@tanstack/react-query";
import { use, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { useReactiveButton } from "@/components/ui/reactive-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInventorySaveLabel, useInventory } from "@/components/use-inventory";
import type { TodayInventoryRow } from "@/lib/daily-inventory";
import type { Dessert } from "@/lib/types";
import { upsertTodayInventory } from "./actions";

async function fetchTodayInventory(signal?: AbortSignal): Promise<TodayInventoryRow[]> {
	const response = await fetch("/api/manager/inventory/today", {
		cache: "no-store",
		signal,
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch today's inventory (${response.status})`);
	}

	return response.json();
}

export default function InventoryPage({
	initialDesserts,
	initialInventory,
}: {
	initialDesserts: Promise<Dessert[]>;
	initialInventory: Promise<TodayInventoryRow[]>;
}) {
	const desserts = use(initialDesserts);
	const serverInventoryRows = use(initialInventory);
	const {
		data: inventoryRows,
		error: inventoryError,
		refetch: refetchInventory,
	} = useQuery({
		queryKey: ["inventory", "today"],
		queryFn: ({ signal }) => fetchTodayInventory(signal),
		initialData: serverInventoryRows,
		staleTime: 30_000,
		gcTime: 5 * 60_000,
	});
	const onRefetch = useCallback(async () => {
		const result = await refetchInventory();
		if (result.error) throw result.error;
		if (!result.data) throw new Error("Refetch completed without fresh inventory data");
		return { desserts, inventory: result.data };
	}, [desserts, refetchInventory]);
	const inventory = useInventory({
		desserts,
		initialInventory: inventoryRows,
		onSave: upsertTodayInventory,
		onRefetch,
	});
	const [saveButton, SaveButton] = useReactiveButton({
		label: "Save",
		loading: { label: "Saving..." },
		success: { label: "Saved" },
		feedbackStyle: "brand",
	});
	const { setLoading, setSuccess, setError, reset } = saveButton;
	const { saveSuccessCount, saveError, isSaving } = inventory;

	// Loading is driven by the inventory hook's isSaving flag. When a save ends
	// without producing a success (failure paths report through saveError to
	// flash an error below), return the button to idle first.
	useEffect(() => {
		if (isSaving) setLoading();
		else reset({ ifStatus: "loading" });
	}, [isSaving, setLoading, reset]);

	// Flash the reported message on the button when a save fails. The id bumps
	// on every failure so repeated identical failures still re-trigger the flash.
	useEffect(() => {
		if (saveError) setError(saveError.message);
	}, [saveError, setError]);

	// Flash success once a save completes; clearing the count (e.g. on edit)
	// dismisses a still-visible success flash.
	useEffect(() => {
		if (saveSuccessCount === null) {
			reset({ ifStatus: "success" });
			return;
		}
		setSuccess(getInventorySaveLabel(saveSuccessCount));
	}, [saveSuccessCount, reset, setSuccess]);

	if (inventoryError) {
		console.error("Failed to fetch today's inventory:", inventoryError);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-baseline justify-between gap-2">
				<div>
					<h1 className="text-2xl font-bold">Inventory</h1>
					<p className="text-sm text-muted-foreground">Today: {inventory.todayLabel}</p>
				</div>
				<SaveButton onClick={inventory.onSaveInventory} disabled={!inventory.hasChanges} />
			</div>

			<div className="overflow-x-auto">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Dessert</TableHead>
							<TableHead className="w-40">Qty</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{desserts.map((dessert) => (
							<TableRow key={dessert.id}>
								<TableCell className="font-medium">{dessert.name}</TableCell>
								<TableCell>
									<Input
										type="number"
										min={0}
										step={1}
										value={inventory.quantities[dessert.id] ?? "0"}
										onChange={(event) => inventory.onQuantityChange(dessert.id, event.target.value)}
										disabled={!dessert.enabled || dessert.hasUnlimitedStock}
										className="h-9"
									/>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
