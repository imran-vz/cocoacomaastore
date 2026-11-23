"use client";

import { ChevronDown } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { RecordList } from "@/components/ui/list-row";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrderDetailPanel } from "@/features/orders/order-detail-panel";
import { OrderStatusBadge } from "@/features/orders/order-status-badge";
import { OrdersEmptyState } from "@/features/orders/orders-empty-state";
import { OrdersSummary } from "@/features/orders/orders-summary";
import type { OrdersView, OrderView } from "@/features/orders/presentation";
import { cn } from "@/lib/utils";

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

function orderMeta(order: OrderView) {
	return [order.timeLabel, order.itemsLabel].join(" · ");
}

/** The first item on its own (up to two lines) with "+N more", so walk-in rows stay recognisable without opening them. */
function OrderItemsPreview({ order }: { order: OrderView }) {
	if (!order.firstItemLabel) return null;
	return (
		<span className="line-clamp-2 text-sm leading-5 text-foreground">
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

/** Finds the row toggle on screen for an order, for focus to return to once a control in its details is gone. */
export type FindOrderToggle = () => HTMLElement | null;

export function CocoaDaybook({
	model,
	showRevenue,
	renderCancelAction,
	targetOrderId,
	isToday,
}: {
	model: OrdersView;
	showRevenue: boolean;
	renderCancelAction?: (order: OrderView, findToggle: FindOrderToggle) => ReactNode;
	targetOrderId?: number | null;
	isToday: boolean;
}) {
	const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
	// Each order has a toggle in the list and in the table; only one layout is displayed at a time.
	const togglesRef = useRef(new Map<number, Set<HTMLElement>>());
	const toggleRef = (orderId: number) => (element: HTMLButtonElement | null) => {
		if (!element) return;
		const toggles = togglesRef.current.get(orderId) ?? new Set();
		togglesRef.current.set(orderId, toggles.add(element));
		return () => {
			toggles.delete(element);
		};
	};
	const findToggle = (orderId: number) => () =>
		[...(togglesRef.current.get(orderId) ?? [])].find((element) => element.offsetParent !== null) ?? null;
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

	const renderCancelActionFor = (order: OrderView) =>
		order.isCancelled ? undefined : renderCancelAction?.(order, findToggle(order.id));

	if (model.orders.length === 0) {
		return <OrdersEmptyState isToday={isToday} />;
	}

	return (
		<section className="space-y-4" aria-label="Orders">
			<OrdersSummary model={model} showRevenue={showRevenue} />

			{/* Records switch on the content width, not the viewport: at 820px with the
			    admin sidebar open the content is ~520px, so the list keeps every amount visible. */}
			<RecordList className="@3xl/main:hidden" aria-label="Orders list">
				{model.orders.map((order) => {
					const isExpanded = expandedOrderId === order.id;
					const contentId = `daybook-mobile-${order.id}`;

					return (
						<li key={order.id} ref={order.id === targetOrderId ? mobileTargetRowRef : undefined}>
							<button
								type="button"
								ref={toggleRef(order.id)}
								aria-expanded={isExpanded}
								aria-controls={contentId}
								onClick={() => toggleOrder(order.id)}
								className={cn(
									"flex min-h-16 w-full items-start gap-3 py-3 pr-3 pl-4 focus-ring-inset text-left transition-colors hover:bg-muted/60 active:bg-muted motion-reduce:transition-none",
									isExpanded && "bg-muted/40",
								)}
							>
								<span className="flex min-w-0 flex-1 flex-col gap-0.5">
									<span className="flex items-baseline justify-between gap-3">
										<span className="min-w-0 truncate text-row text-foreground">
											<span className="tabular-nums">{order.orderLabel}</span>
											{!order.isWalkInCustomer && <span> · {order.customerName}</span>}
										</span>
										<span
											className={cn(
												"shrink-0 text-row tabular-nums",
												order.isCancelled ? "text-muted-foreground line-through" : "text-foreground",
											)}
										>
											{order.totalLabel}
										</span>
									</span>
									<OrderItemsPreview order={order} />
									<span className="flex min-h-5 items-center justify-between gap-3">
										<span className="min-w-0 truncate text-meta text-muted-foreground tabular-nums">
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
									className="border-t bg-muted/40 px-4 pt-3 pb-4 animate-in fade-in-0 slide-in-from-top-1 duration-enter ease-out motion-reduce:animate-none"
								>
									<OrderDetailPanel order={order} cancelAction={renderCancelActionFor(order)} />
								</div>
							)}
						</li>
					);
				})}
			</RecordList>

			<div className="surface-card hidden @3xl/main:block">
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
													ref={toggleRef(order.id)}
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
												<div className="animate-in fade-in-0 slide-in-from-top-1 duration-enter ease-out motion-reduce:animate-none">
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
