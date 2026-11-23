"use client";

import { useState } from "react";
import type { DessertStock } from "@/app/admin/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow, ListSection, RecordList } from "@/components/ui/list-row";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount, formatNumber } from "@/lib/format";

const PREVIEW_COUNT = 5;
const LOW_STOCK_LIMIT = 10;

/** Counted stock, lowest first, sold out last among them. */
function sortStock(stock: DessertStock[]) {
	return [...stock].sort((a, b) => {
		if (a.currentStock <= 0 && b.currentStock > 0) return 1;
		if (a.currentStock > 0 && b.currentStock <= 0) return -1;
		if (a.currentStock !== b.currentStock) return a.currentStock - b.currentStock;
		return a.name.localeCompare(b.name);
	});
}

/** A badge only for the exceptions (Sold out, Low); healthy stock gets none. */
function stockStatus(item: DessertStock) {
	if (item.currentStock <= 0) return <Badge variant="destructive">Sold out</Badge>;
	if (item.currentStock <= LOW_STOCK_LIMIT) return <Badge variant="warning">Low</Badge>;
	return undefined;
}

/**
 * Stock levels on Insights › Day: desserts with counted stock (first five plus "Show
 * all", no nested scroll), then one row for every dessert with unlimited stock, which
 * has nothing to count, linking to Catalog.
 */
export default function StockList({ stock, isLoading }: { stock: DessertStock[]; isLoading?: boolean }) {
	const [showAll, setShowAll] = useState(false);
	const onSale = stock.filter((item) => item.enabled);
	const counted = sortStock(onSale.filter((item) => !item.hasUnlimitedStock));
	const unlimitedCount = onSale.length - counted.length;
	const visibleStock = showAll ? counted : counted.slice(0, PREVIEW_COUNT);

	return (
		<ListSection title="Stock levels" count={isLoading || counted.length === 0 ? undefined : counted.length}>
			{isLoading ? (
				<RecordList aria-hidden="true">
					{["one", "two", "three"].map((slot) => (
						<li key={slot} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
							<Skeleton className="h-4 w-40" />
							<Skeleton className="h-4 w-10" />
						</li>
					))}
				</RecordList>
			) : onSale.length === 0 ? (
				<EmptyState description="No desserts are on sale." />
			) : (
				<RecordList aria-label="Stock levels">
					{visibleStock.map((item) => (
						<ListRow
							key={item.id}
							title={item.name}
							trailing={formatNumber(item.currentStock)}
							trailingMeta={stockStatus(item)}
						/>
					))}
					{counted.length > PREVIEW_COUNT ? (
						<li>
							<button
								type="button"
								aria-expanded={showAll}
								onClick={() => setShowAll((value) => !value)}
								className="focus-ring flex min-h-12 w-full items-center px-4 text-sm font-semibold text-primary hover:bg-muted/60"
							>
								{showAll ? "Show less" : `Show all ${formatNumber(counted.length)}`}
							</button>
						</li>
					) : null}
					{unlimitedCount > 0 ? (
						<ListRow
							href="/admin/desserts"
							title={`${formatCount(unlimitedCount, "desserts")} ${unlimitedCount === 1 ? "has" : "have"} unlimited stock`}
							meta="Nothing to count · Manage in Catalog"
						/>
					) : null}
				</RecordList>
			)}
		</ListSection>
	);
}
