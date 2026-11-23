"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow, ListSection, RecordList, RecordListSkeleton } from "@/components/ui/list-row";
import { ShowAllRow } from "@/features/insights/show-all-row";
import { type DessertStock, isCounted } from "@/features/inventory/shapes";
import { UnlimitedStockRow } from "@/features/inventory/stock-ui";
import { sectionHref } from "@/features/shell/routes";
import { formatNumber } from "@/lib/format";

const PREVIEW_COUNT = 5;
const LOW_STOCK_LIMIT = 10;
const CATALOG_HREF = sectionHref("admin", "catalog");

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
 * all", no nested scroll), then the unlimited-stock row.
 */
export default function StockList({ stock, isLoading }: { stock: DessertStock[]; isLoading?: boolean }) {
	const [showAll, setShowAll] = useState(false);
	const onSale = stock.filter((item) => item.enabled);
	const counted = sortStock(stock.filter(isCounted));
	const unlimitedCount = onSale.length - counted.length;
	const visibleStock = showAll ? counted : counted.slice(0, PREVIEW_COUNT);

	return (
		<ListSection title="Stock levels" count={isLoading || counted.length === 0 ? undefined : counted.length}>
			{isLoading ? (
				<RecordListSkeleton rows={3} metaLines={0} trailing />
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
						<ShowAllRow
							label={`Show all ${formatNumber(counted.length)}`}
							expanded={showAll}
							onToggle={() => setShowAll((value) => !value)}
						/>
					) : null}
					{unlimitedCount > 0 ? <UnlimitedStockRow count={unlimitedCount} catalogHref={CATALOG_HREF} /> : null}
				</RecordList>
			)}
		</ListSection>
	);
}
