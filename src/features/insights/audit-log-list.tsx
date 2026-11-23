"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow, ListSection, RecordList, RecordListSkeleton } from "@/components/ui/list-row";
import { ShowAllRow } from "@/features/insights/show-all-row";
import type { StockChange, StockChangeAction, StockChanges } from "@/features/inventory/shapes";
import { orderHref } from "@/features/orders/links";
import { formatNumber, formatOrderNumber, formatSigned, formatTime } from "@/lib/format";
import type { DayKey } from "@/lib/shop-calendar";

const PREVIEW_COUNT = 6;

const ACTION_LABELS: Record<StockChangeAction, string> = {
	set_stock: "Set stock",
	order_deducted: "Order",
	manual_adjustment: "Manual",
	order_cancelled: "Cancelled",
};

function logMeta(log: StockChange) {
	const parts = [
		log.action === "order_cancelled" ? null : ACTION_LABELS[log.action],
		log.orderId ? formatOrderNumber(log.orderId) : null,
		`${formatNumber(log.previousQuantity)} → ${formatNumber(log.newQuantity)}`,
		log.action === "order_cancelled" && log.note ? log.note : null,
	];
	return parts.filter(Boolean).join(" · ");
}

/**
 * Changes to `day`'s stock on Insights › Day, newest first. Collapses to one line when the day
 * has none. Only the latest changes are read, so "Show" names how many of the day's total it adds.
 */
export default function AuditLogList({
	day,
	log: { entries: logs, total },
	isLoading,
}: {
	day: DayKey;
	log: StockChanges;
	isLoading?: boolean;
}) {
	const [showAll, setShowAll] = useState(false);
	const visibleLogs = showAll ? logs : logs.slice(0, PREVIEW_COUNT);
	const expandLabel =
		logs.length < total
			? `Show latest ${formatNumber(logs.length)} of ${formatNumber(total)}`
			: `Show all ${formatNumber(total)}`;

	return (
		<ListSection title="Audit log" count={isLoading || total === 0 ? undefined : total}>
			{isLoading ? (
				<RecordListSkeleton rows={3} trailing />
			) : logs.length === 0 ? (
				<EmptyState description="No stock changes on this day." />
			) : (
				<RecordList aria-label="Audit log">
					{visibleLogs.map((log) => (
						<ListRow
							key={log.id}
							href={log.orderId ? orderHref("admin", day, log.orderId) : undefined}
							rowLabel={log.orderId ? `${log.dessertName}, order ${formatOrderNumber(log.orderId)}` : undefined}
							title={log.dessertName}
							meta={
								<>
									{log.action === "order_cancelled" ? (
										<Badge variant="destructive" className="mr-1.5 align-[1px]">
											Cancelled
										</Badge>
									) : null}
									{logMeta(log)}
								</>
							}
							trailing={formatSigned(log.newQuantity - log.previousQuantity)}
							trailingMeta={formatTime(log.createdAt)}
						/>
					))}
					{logs.length > PREVIEW_COUNT ? (
						<ShowAllRow label={expandLabel} expanded={showAll} onToggle={() => setShowAll((value) => !value)} />
					) : null}
				</RecordList>
			)}
		</ListSection>
	);
}
