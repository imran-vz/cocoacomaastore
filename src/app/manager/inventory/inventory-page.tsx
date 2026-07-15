"use client";

import { useQuery } from "@tanstack/react-query";
import { use, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInventory } from "@/components/use-inventory";
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
				<Button onClick={inventory.onSaveInventory} disabled={inventory.isSaving || !inventory.hasChanges}>
					{inventory.isSaving ? <Spinner /> : "Save"}
				</Button>
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
