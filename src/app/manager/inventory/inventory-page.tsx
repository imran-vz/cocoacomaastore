"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use, useCallback } from "react";
import { InventorySaveBar, StockField } from "@/components/desserts-table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow, ListSection, RecordList } from "@/components/ui/list-row";
import { PageHeader } from "@/components/ui/page-header";
import { useInventory } from "@/components/use-inventory";
import type { TodayInventoryRow } from "@/lib/daily-inventory";
import { formatCount, formatINR } from "@/lib/format";
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

	const tracked = desserts.filter((dessert) => !dessert.hasUnlimitedStock);
	const unlimited = desserts.filter((dessert) => dessert.hasUnlimitedStock);

	const renderRow = (dessert: Dessert) => {
		const changed = inventory.changedDessertIds.has(dessert.id);
		const saved = inventory.serverQuantities.get(dessert.id) ?? 0;
		const meta = [formatINR(dessert.price), !dessert.enabled ? "Hidden" : null, changed ? `was ${saved}` : null]
			.filter(Boolean)
			.join(" · ");
		return (
			<ListRow
				key={dessert.id}
				title={dessert.name}
				meta={meta}
				action={
					<StockField
						dessert={dessert}
						value={inventory.quantities[dessert.id] ?? "0"}
						changed={changed}
						onChange={(value) => inventory.onQuantityChange(dessert.id, value)}
						disabled={!dessert.enabled}
					/>
				}
			/>
		);
	};

	return (
		<div className="w-full">
			<PageHeader title="Stock" description={`Today · ${inventory.todayLabel}`} />

			{desserts.length === 0 ? (
				<EmptyState
					variant="block"
					title="Nothing is on sale today"
					description="Turn desserts on in Catalog to count their stock here."
					action={
						<Button variant="outline" render={<Link href="/manager/desserts" />}>
							Open Catalog
						</Button>
					}
				/>
			) : (
				<div className="flex flex-col gap-6">
					{tracked.length > 0 ? (
						<ListSection title="To count" count={tracked.length}>
							<RecordList aria-label="Stock to count today">{tracked.map(renderRow)}</RecordList>
						</ListSection>
					) : (
						<EmptyState
							variant="block"
							title="Nothing to count today"
							description="Every dessert on sale has unlimited stock."
						/>
					)}
					{unlimited.length > 0 ? (
						<RecordList aria-label="Desserts with unlimited stock">
							<ListRow
								href="/manager/desserts"
								title={`${formatCount(unlimited.length, { one: "dessert has", other: "desserts have" })} unlimited stock`}
								meta="Not counted. Change it in Catalog."
							/>
						</RecordList>
					) : null}
				</div>
			)}

			<InventorySaveBar inventory={inventory} />
		</div>
	);
}
