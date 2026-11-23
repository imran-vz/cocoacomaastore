"use client";

import { useState } from "react";
import type { AuditLogEntry } from "@/app/admin/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow, ListSection, RecordList } from "@/components/ui/list-row";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatTime } from "@/lib/format";

const PREVIEW_COUNT = 6;

const ACTION_LABELS: Record<string, string> = {
	set_stock: "Set stock",
	order_deducted: "Order",
	manual_adjustment: "Manual",
	order_cancelled: "Cancelled",
};

function formatDelta(delta: number) {
	if (delta === 0) return "0";
	return `${delta > 0 ? "+" : "−"}${formatNumber(Math.abs(delta))}`;
}

function logMeta(log: AuditLogEntry) {
	const parts = [
		log.action === "order_cancelled" ? null : (ACTION_LABELS[log.action] ?? log.action),
		log.orderId ? `#${log.orderId}` : null,
		`${formatNumber(log.previousQuantity)} → ${formatNumber(log.newQuantity)}`,
		log.action === "order_cancelled" && log.note ? log.note : null,
	];
	return parts.filter(Boolean).join(" · ");
}

/** Stock changes on Insights › Today. Collapses to one line when the day has none. */
export default function AuditLogList({ logs, isLoading }: { logs: AuditLogEntry[]; isLoading?: boolean }) {
	const [showAll, setShowAll] = useState(false);
	const visibleLogs = showAll ? logs : logs.slice(0, PREVIEW_COUNT);

	return (
		<ListSection title="Audit log" count={isLoading || logs.length === 0 ? undefined : logs.length}>
			{isLoading ? (
				<RecordList aria-hidden="true">
					{["one", "two", "three"].map((slot) => (
						<li key={slot} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
							<div className="space-y-2">
								<Skeleton className="h-4 w-36" />
								<Skeleton className="h-3 w-24" />
							</div>
							<Skeleton className="h-4 w-10" />
						</li>
					))}
				</RecordList>
			) : logs.length === 0 ? (
				<EmptyState description="No stock changes on this day." />
			) : (
				<RecordList aria-label="Audit log">
					{visibleLogs.map((log) => (
						<ListRow
							key={log.id}
							href={log.orderId ? `/admin/orders?orderId=${log.orderId}` : undefined}
							rowLabel={log.orderId ? `${log.dessertName}, order #${log.orderId}` : undefined}
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
							trailing={formatDelta(log.newQuantity - log.previousQuantity)}
							trailingMeta={formatTime(log.createdAt)}
						/>
					))}
					{logs.length > PREVIEW_COUNT ? (
						<li>
							<button
								type="button"
								aria-expanded={showAll}
								onClick={() => setShowAll((value) => !value)}
								className="focus-ring flex min-h-12 w-full items-center px-4 text-sm font-semibold text-primary hover:bg-muted/60"
							>
								{showAll ? "Show less" : `Show all ${formatNumber(logs.length)}`}
							</button>
						</li>
					) : null}
				</RecordList>
			)}
		</ListSection>
	);
}
