"use client";

import { ChevronDown } from "lucide-react";
import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { OrderDetailPanel } from "../components/order-detail-panel";
import { OrderStatusBadge } from "../components/order-status-badge";
import { OrdersEmptyState } from "../components/orders-empty-state";
import { OrdersSummary } from "../components/orders-summary";
import type { ManagerOrdersViewModel } from "../orders-view-model";
import type { CancelOrderHandler } from "../use-manager-orders-controller";

export function CocoaDaybook({
	model,
	onCancelOrder,
}: {
	model: ManagerOrdersViewModel;
	onCancelOrder: CancelOrderHandler;
}) {
	const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

	const toggleOrder = (orderId: number) => {
		setExpandedOrderId((current) => (current === orderId ? null : orderId));
	};

	if (model.orders.length === 0) {
		return <OrdersEmptyState className="mx-auto max-w-6xl" />;
	}

	return (
		<section className="mx-auto max-w-6xl space-y-3" aria-label="Cocoa Daybook order layout">
			<OrdersSummary model={model} />

			<div className="overflow-hidden rounded-xl border bg-card md:hidden">
				<ul className="divide-y">
					{model.orders.map((order) => {
						const isExpanded = expandedOrderId === order.id;
						const contentId = `daybook-mobile-${order.id}`;

						return (
							<li key={order.id}>
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
										<OrderDetailPanel order={order} onCancelOrder={onCancelOrder} />
									</div>
								)}
							</li>
						);
					})}
				</ul>
			</div>

			<div className="hidden overflow-hidden rounded-xl border bg-card shadow-xs md:block">
				<Table>
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
					<TableBody>
						{model.orders.map((order) => {
							const isExpanded = expandedOrderId === order.id;
							const contentId = `daybook-table-${order.id}`;

							return (
								<Fragment key={order.id}>
									<TableRow data-state={isExpanded ? "selected" : undefined}>
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
												<OrderDetailPanel order={order} onCancelOrder={onCancelOrder} className="mx-auto max-w-3xl" />
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
