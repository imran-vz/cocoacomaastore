"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SetStateAction } from "react";
import { use, useCallback } from "react";
import { DessertsTable } from "@/components/desserts-table";
import { useInventory } from "@/components/use-inventory";
import type { TodayInventoryRow } from "@/lib/daily-inventory";
import type { Dessert } from "@/lib/types";
import { upsertInventoryWithAudit } from "./actions";

const dessertsQueryKey = ["desserts", { shouldShowDisabled: true }] as const;
const inventoryQueryKey = ["inventory", "today"] as const;

async function fetchDesserts(signal?: AbortSignal): Promise<Dessert[]> {
	const response = await fetch("/api/desserts?shouldShowDisabled=true", {
		cache: "no-store",
		signal,
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch desserts (${response.status})`);
	}

	return response.json();
}

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

export default function ManageDessertsInventory({
	initialDesserts,
	initialInventory,
}: {
	initialDesserts: Promise<Dessert[]>;
	initialInventory: Promise<TodayInventoryRow[]>;
}) {
	const queryClient = useQueryClient();
	const dessertsData = use(initialDesserts);
	const inventoryData = use(initialInventory);

	const {
		data: desserts,
		error: dessertsError,
		refetch: refetchDesserts,
	} = useQuery({
		queryKey: dessertsQueryKey,
		queryFn: ({ signal }) => fetchDesserts(signal),
		initialData: dessertsData,
		staleTime: 60_000,
		gcTime: 10 * 60_000,
	});

	const {
		data: inventoryRows,
		error: inventoryError,
		refetch: refetchInventory,
	} = useQuery({
		queryKey: inventoryQueryKey,
		queryFn: ({ signal }) => fetchTodayInventory(signal),
		initialData: inventoryData,
		staleTime: 30_000,
		gcTime: 5 * 60_000,
	});

	const setDesserts = useCallback(
		(updater: SetStateAction<Dessert[]>) => {
			queryClient.setQueryData<Dessert[]>(dessertsQueryKey, (current = []) =>
				typeof updater === "function" ? updater(current) : updater,
			);
		},
		[queryClient],
	);

	const refetchAll = useCallback(async () => {
		const [dessertsResult, inventoryResult] = await Promise.all([refetchDesserts(), refetchInventory()]);
		const newDesserts = dessertsResult.data ?? desserts;
		const newInventory = inventoryResult.data ?? inventoryRows;
		return { desserts: newDesserts, inventory: newInventory };
	}, [desserts, inventoryRows, refetchDesserts, refetchInventory]);

	const refetch = useCallback(async () => {
		await refetchAll();
	}, [refetchAll]);

	if (dessertsError) {
		console.error("Failed to fetch desserts:", dessertsError);
	}
	if (inventoryError) {
		console.error("Failed to fetch today's inventory:", inventoryError);
	}

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
