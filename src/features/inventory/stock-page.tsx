"use client";

import Link from "next/link";
import { use } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow, ListSection, RecordList } from "@/components/ui/list-row";
import { PageHeader } from "@/components/ui/page-header";
import { dessertsQuery } from "@/features/catalog/client";
import type { Dessert } from "@/features/catalog/queries";
import { type DayInventory, isCounted } from "@/features/inventory/shapes";
import { StockField, StockSaveBar, startingCountNote, UnlimitedStockRow } from "@/features/inventory/stock-ui";
import { useStockCount } from "@/features/inventory/use-stock-count";
import { useTodayInventory } from "@/features/inventory/use-today-inventory";
import { sectionHref } from "@/features/shell/routes";
import { usePageTitle } from "@/features/shell/use-page-chrome";
import { formatDate, formatINR } from "@/lib/format";
import type { ServerSnapshot } from "@/lib/server-snapshot";
import { useSeededQuery } from "@/lib/use-seeded-query";

const CATALOG_HREF = sectionHref("manager", "catalog");

/** The Stock screen: today's counts for every dessert on sale. */
export function StockPage({
	desserts: dessertsPromise,
	inventory: initialInventory,
}: {
	/** Every dessert in the catalog, as Catalog reads it; hidden ones are left out here. */
	desserts: Promise<ServerSnapshot<Dessert[]>>;
	inventory: Promise<ServerSnapshot<DayInventory>>;
}) {
	const { data: catalog } = useSeededQuery(dessertsQuery, use(dessertsPromise));
	const desserts = catalog.filter((dessert) => dessert.enabled);
	const inventory = useTodayInventory(use(initialInventory));
	const stock = useStockCount(desserts, inventory);
	const title = usePageTitle();

	const tracked = desserts.filter(isCounted);
	const unlimited = desserts.filter((dessert) => !isCounted(dessert));

	const renderRow = (dessert: Dessert) => (
		<ListRow
			key={dessert.id}
			title={dessert.name}
			meta={[formatINR(dessert.price), startingCountNote(stock, dessert.id)].filter(Boolean).join(" · ")}
			action={<StockField stock={stock} dessert={dessert} />}
		/>
	);

	return (
		<div className="w-full">
			<PageHeader title={title} description={`Today · ${formatDate(inventory.dayKey)}`} />

			{inventory.refreshFailed ? (
				<EmptyState
					className="mb-4"
					description="Couldn't refresh today's stock. These counts may be out of date."
					onRetry={() => void inventory.refresh()}
				/>
			) : null}

			{desserts.length === 0 ? (
				<EmptyState
					variant="block"
					title="Nothing is on sale today"
					description="Turn desserts on in Catalog to count their stock here."
					action={
						<Button variant="outline" render={<Link href={CATALOG_HREF} />}>
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
							<UnlimitedStockRow count={unlimited.length} catalogHref={CATALOG_HREF} />
						</RecordList>
					) : null}
				</div>
			)}

			<StockSaveBar stock={stock} />
		</div>
	);
}
