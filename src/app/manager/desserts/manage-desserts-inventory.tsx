"use client";

import { use, useCallback, useState } from "react";
import { getCachedDesserts } from "@/app/desserts/actions";
import {
	getCachedTodayInventory,
	type TodayInventoryRow,
} from "@/app/manager/inventory/actions";
import { DessertsTable } from "@/components/desserts-table";
import { useInventory } from "@/components/use-inventory";
import type { Dessert } from "@/lib/types";
import { upsertInventoryWithAudit } from "./actions";

export default function ManageDessertsInventory({
	initialDesserts,
	initialInventory,
}: {
	initialDesserts: Promise<Dessert[]>;
	initialInventory: Promise<TodayInventoryRow[]>;
}) {
	const dessertsData = use(initialDesserts);
	const inventoryRows = use(initialInventory);

	const [desserts, setDesserts] = useState<Dessert[]>(dessertsData);

	const refetchAll = useCallback(async () => {
		const [newDesserts, newInventory] = await Promise.all([
			getCachedDesserts({ shouldShowDisabled: true }),
			getCachedTodayInventory(),
		]);
		setDesserts(newDesserts);
		return { desserts: newDesserts, inventory: newInventory };
	}, []);

	const refetch = useCallback(async () => {
		const { desserts: newDesserts } = await refetchAll();
		setDesserts(newDesserts);
	}, [refetchAll]);

	const inventory = useInventory({
		desserts,
		initialInventory: inventoryRows,
		onSave: upsertInventoryWithAudit,
		onRefetch: refetchAll,
	});

	return (
		<DessertsTable
			desserts={desserts}
			setDesserts={setDesserts}
			onRefetch={refetch}
			inventory={inventory}
			title="Desserts & Inventory"
			maxWidth="max-w-4xl"
		/>
	);
}
