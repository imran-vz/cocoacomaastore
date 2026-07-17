"use client";

import { ChevronDown } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { OrderDetailPanel } from "./order-detail-panel";
import { OrderStatusBadge } from "./order-status-badge";
import { OrdersEmptyState } from "./orders-empty-state";
import { OrdersSummary, type OrdersSummaryMetric } from "./orders-summary";
import type { OrdersViewModel, OrderViewModel } from "./orders-view-model";

export function DaybookTableColumns() {
	return (
		<TableHeader className="bg-muted/50">
			<TableRow className="hover:bg-transparent">
				<TableHead className="w-28">Time</TableHead>
				<TableHead className="w-24">Order</TableHead>
				<TableHead>Details</TableHead>
				<TableHead className="w-20 text-right">Qty</TableHead>
				<TableHead className="w-28 text-right">Total</TableHead>
				<TableHead className="w-32 text-right">Status</TableHead>
			</TableRow>
		</TableHeader>
	);
}

export function CocoaDaybook({
	model,
	additionalMetric,
	renderCancelAction,
	targetOrderId,
	emptyState,
}: {
	model: OrdersViewModel;
	additionalMetric?: OrdersSummaryMetric;
	renderCancelAction?: (order: OrderViewModel) => ReactNode;
	targetOrderId?: number | null;
	emptyState?: { title?: string; description?: string };
}) {
	const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
	const mobileTargetRowRef = useRef<HTMLLIElement | null>(null);
	const tableTargetRowRef = useRef<HTMLTableRowElement | null>(null);
	const appliedTargetOrderIdRef = useRef<number | null>(null);
	const pendingScrollOrderIdRef = useRef<number | null>(null);

	// Deep links expand and reveal their order once; afterwards normal toggling wins.
	useEffect(() => {
		if (targetOrderId == null || appliedTargetOrderIdRef.current === targetOrderId) return;
		if (!model.orders.some((order) => order.id === targetOrderId)) return;

		appliedTargetOrderIdRef.current = targetOrderId;
		pendingScrollOrderIdRef.current = targetOrderId;
		setExpandedOrderId(targetOrderId);
	}, [targetOrderId, model.orders]);

	// Runs after the expanded row has committed, so the scroll centers on final geometry.
	useEffect(() => {
		if (expandedOrderId == null || pendingScrollOrderIdRef.current !== expandedOrderId) return;

		pendingScrollOrderIdRef.current = null;
		const visibleRow = [mobileTargetRowRef.current, tableTargetRowRef.current].find(
			(element) => element && element.offsetParent !== null,
		);
		visibleRow?.scrollIntoView({ behavior: "smooth", block: "center" });
	}, [expandedOrderId]);

	const toggleOrder = (orderId: number) => {
		setExpandedOrderId((current) => (current === orderId ? null : orderId));
	};

	// Cancelled orders never offer cancellation; the renderer only decides role policy.
	const renderCancelActionFor = (order: OrderViewModel) =>
		order.isCancelled ? undefined : renderCancelAction?.(order);

	if (model.orders.length === 0) {
		return <OrdersEmptyState className="mx-auto max-w-6xl" {...emptyState} />;
	}

	return (
		<section className="mx-auto max-w-6xl space-y-3" aria-label="Cocoa Daybook order layout">
			<OrdersSummary model={model} additionalMetric={additionalMetric} />

			<div className="overflow-hidden rounded-xl border bg-card md:hidden">
				<ul className="divide-y">
					{model.orders.map((order) => {
						const isExpanded = expandedOrderId === order.id;
						const contentId = `daybook-mobile-${order.id}`;

						return (
							<li key={order.id} ref={order.id === targetOrderId ? mobileTargetRowRef : undefined}>
								<button
									type="button"
									aria-expanded={isExpanded}
									aria-controls={contentId}
									onClick={() => toggleOrder(order.id)}
									className="w-full px-3 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none"
								>
									<span className="flex items-center gap-2">
										<span className="font-mono text-xs text-muted-foreground tabular-nums">{order.timeLabel}</span>
										<Badge variant="outline" className="font-mono">
											{order.orderLabel}
										</Badge>
										<span className="shrink-0 text-xs text-muted-foreground">
											{order.totalItems} item{order.totalItems === 1 ? "" : "s"}
										</span>
										<span
											className={cn(
												"ml-auto font-mono font-semibold tabular-nums",
												order.isCancelled && "line-through",
											)}
										>
											{order.totalLabel}
										</span>
										<ChevronDown
											aria-hidden="true"
											className={cn(
												"size-4 text-muted-foreground transition-transform motion-reduce:transition-none",
												isExpanded && "rotate-180",
											)}
										/>
									</span>
									<span className="mt-2 flex min-w-0 items-center gap-2">
										<span
											className={cn(
												"truncate",
												order.isWalkInCustomer ? "text-sm text-muted-foreground" : "font-semibold",
											)}
										>
											{order.isWalkInCustomer ? order.itemsSummary : order.customerName}
										</span>
										<span className="ml-auto shrink-0">
											<OrderStatusBadge order={order} />
										</span>
									</span>
								</button>

								{isExpanded && (
									<div id={contentId} className="border-t bg-muted/20 px-3 py-3">
										<OrderDetailPanel order={order} cancelAction={renderCancelActionFor(order)} />
									</div>
								)}
							</li>
						);
					})}
				</ul>
			</div>

			<div className="hidden overflow-hidden rounded-xl border bg-card shadow-xs md:block">
				<Table>
					<DaybookTableColumns />
					<TableBody>
						{model.orders.map((order) => {
							const isExpanded = expandedOrderId === order.id;
							const contentId = `daybook-table-${order.id}`;

							return (
								<Fragment key={order.id}>
									<TableRow
										ref={order.id === targetOrderId ? tableTargetRowRef : undefined}
										data-state={isExpanded ? "selected" : undefined}
									>
										<TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
											{order.timeLabel}
										</TableCell>
										<TableCell>
											<Badge variant="outline" className="font-mono">
												{order.orderLabel}
											</Badge>
										</TableCell>
										<TableCell className="max-w-80">
											{!order.isWalkInCustomer && <p className="truncate font-medium">{order.customerName}</p>}
											<p className={cn("truncate text-sm text-muted-foreground", !order.isWalkInCustomer && "mt-0.5")}>
												{order.itemsSummary}
											</p>
										</TableCell>
										<TableCell className="text-right font-mono tabular-nums">{order.totalItems}</TableCell>
										<TableCell
											className={cn(
												"text-right font-mono font-semibold tabular-nums",
												order.isCancelled && "line-through",
											)}
										>
											{order.totalLabel}
										</TableCell>
										<TableCell>
											<div className="flex items-center justify-end gap-2">
												<OrderStatusBadge order={order} />
												<button
													type="button"
													aria-label={`${isExpanded ? "Hide" : "Show"} details for order ${order.orderLabel}`}
													aria-expanded={isExpanded}
													aria-controls={contentId}
													onClick={() => toggleOrder(order.id)}
													className="grid size-8 place-items-center rounded-lg hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
												>
													<ChevronDown
														aria-hidden="true"
														className={cn(
															"size-4 transition-transform motion-reduce:transition-none",
															isExpanded && "rotate-180",
														)}
													/>
												</button>
											</div>
										</TableCell>
									</TableRow>
									{isExpanded && (
										<TableRow id={contentId} className="hover:bg-transparent">
											<TableCell colSpan={6} className="whitespace-normal bg-muted/20 p-4">
												<OrderDetailPanel
													order={order}
													cancelAction={renderCancelActionFor(order)}
													className="mx-auto max-w-3xl"
												/>
											</TableCell>
										</TableRow>
									)}
								</Fragment>
							);
						})}
					</TableBody>
				</Table>
			</div>
		</section>
	);
}
