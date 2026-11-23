"use client";

import { ChevronDown } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
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
				<TableHead className="w-24 pl-4">Order</TableHead>
				<TableHead className="w-24">Time</TableHead>
				<TableHead>Items</TableHead>
				<TableHead className="w-16 text-right">Qty</TableHead>
				<TableHead className="w-28 text-right">Total</TableHead>
				<TableHead className="w-32 pr-4 text-right">
					<span className="sr-only">Status and details</span>
				</TableHead>
			</TableRow>
		</TableHeader>
	);
}

/** Line 3 of a row: `12:30 AM · 5 items`. */
function orderMeta(order: OrderViewModel) {
	return [order.timeLabel, order.itemsLabel].join(" · ");
}

/**
 * The first item on its own (up to two lines) with "+N more" (X1-7), so walk-in rows stay
 * recognisable without opening them.
 */
function OrderItemsPreview({ order, className }: { order: OrderViewModel; className?: string }) {
	if (!order.firstItemLabel) return null;
	return (
		<span className={cn("line-clamp-2 text-sm leading-5 text-foreground", className)}>
			{order.firstItemLabel}
			{order.moreItemsLabel ? (
				<>
					{" "}
					<span className="whitespace-nowrap text-muted-foreground tabular-nums">{order.moreItemsLabel}</span>
				</>
			) : null}
		</span>
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
		return <OrdersEmptyState {...emptyState} />;
	}

	return (
		<section className="space-y-4" aria-label="Orders">
			<OrdersSummary model={model} additionalMetric={additionalMetric} />

			{/* Records switch on the content width, not the viewport (decision 1): at 820px with the
			    admin sidebar open the content is ~520px, so the list keeps every amount visible. */}
			<ul className="divide-y overflow-hidden rounded-xl border bg-card @3xl/main:hidden" aria-label="Orders list">
				{model.orders.map((order) => {
					const isExpanded = expandedOrderId === order.id;
					const contentId = `daybook-mobile-${order.id}`;

					return (
						<li key={order.id} ref={order.id === targetOrderId ? mobileTargetRowRef : undefined}>
							<button
								type="button"
								data-order-toggle={order.id}
								aria-expanded={isExpanded}
								aria-controls={contentId}
								onClick={() => toggleOrder(order.id)}
								className={cn(
									"flex min-h-16 w-full items-start gap-3 py-3 pr-3 pl-4 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--focus-ring) active:bg-muted motion-reduce:transition-none",
									isExpanded && "bg-muted/40",
								)}
							>
								<span className="flex min-w-0 flex-1 flex-col gap-0.5">
									<span className="flex items-baseline justify-between gap-3">
										<span className="min-w-0 truncate text-[15px] leading-5 font-semibold text-foreground">
											<span className="tabular-nums">{order.orderLabel}</span>
											{!order.isWalkInCustomer && <span> · {order.customerName}</span>}
										</span>
										<span
											className={cn(
												"shrink-0 text-[15px] leading-5 font-semibold tabular-nums",
												order.isCancelled ? "text-muted-foreground line-through" : "text-foreground",
											)}
										>
											{order.totalLabel}
										</span>
									</span>
									<OrderItemsPreview order={order} />
									<span className="flex min-h-5 items-center justify-between gap-3">
										<span className="min-w-0 truncate text-[13px] leading-[18px] text-muted-foreground tabular-nums">
											{orderMeta(order)}
										</span>
										<OrderStatusBadge order={order} />
									</span>
								</span>
								<ChevronDown
									aria-hidden="true"
									className={cn(
										"mt-0.5 size-5 shrink-0 text-muted-foreground/70 transition-transform motion-reduce:transition-none",
										isExpanded && "rotate-180",
									)}
								/>
							</button>

							{isExpanded && (
								<div
									id={contentId}
									className="border-t bg-muted/40 px-4 pt-3 pb-4 animate-in fade-in-0 slide-in-from-top-1 duration-200 ease-out motion-reduce:animate-none"
								>
									<OrderDetailPanel order={order} cancelAction={renderCancelActionFor(order)} />
								</div>
							)}
						</li>
					);
				})}
			</ul>

			<div className="hidden rounded-xl border bg-card @3xl/main:block [&_[data-slot=table-container]]:rounded-xl">
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
										className="cursor-pointer"
										onClick={() => toggleOrder(order.id)}
									>
										<TableCell className="pl-4 font-semibold tabular-nums">{order.orderLabel}</TableCell>
										<TableCell className="text-muted-foreground tabular-nums">{order.timeLabel}</TableCell>
										<TableCell className="min-w-48 whitespace-normal">
											{!order.isWalkInCustomer && <p className="truncate font-semibold">{order.customerName}</p>}
											<OrderItemsPreview order={order} />
										</TableCell>
										<TableCell className="text-right tabular-nums">{order.totalItems}</TableCell>
										<TableCell
											className={cn(
												"text-right font-semibold tabular-nums",
												order.isCancelled && "text-muted-foreground line-through",
											)}
										>
											{order.totalLabel}
										</TableCell>
										<TableCell className="pr-4">
											<div className="flex items-center justify-end gap-2">
												<OrderStatusBadge order={order} />
												<button
													type="button"
													data-order-toggle={order.id}
													aria-label={`${isExpanded ? "Hide" : "Show"} details for order ${order.orderLabel}`}
													aria-expanded={isExpanded}
													aria-controls={contentId}
													onClick={(event) => {
														event.stopPropagation();
														toggleOrder(order.id);
													}}
													className="focus-ring grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
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
											<TableCell colSpan={6} className="whitespace-normal bg-muted/40 px-4 py-4">
												<div className="animate-in fade-in-0 slide-in-from-top-1 duration-200 ease-out motion-reduce:animate-none">
													<OrderDetailPanel
														order={order}
														cancelAction={renderCancelActionFor(order)}
														className="ml-24 max-w-xl"
													/>
												</div>
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
