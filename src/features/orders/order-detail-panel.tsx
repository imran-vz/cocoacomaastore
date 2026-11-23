import type { ReactNode } from "react";
import { OrderInvoiceButton } from "@/features/orders/order-invoice-button";
import { OrderLineItems } from "@/features/orders/order-line-items";
import type { OrderView } from "@/features/orders/presentation";
import { cn } from "@/lib/utils";

export function OrderDetailPanel({
	order,
	cancelAction,
	className,
}: {
	order: OrderView;
	cancelAction?: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("space-y-3", className)}>
			<OrderLineItems order={order} />

			<dl className="space-y-1.5 border-t pt-3 text-sm">
				{order.deliveryCostLabel && (
					<div className="flex items-baseline justify-between gap-4 text-muted-foreground">
						<dt>Delivery</dt>
						<dd className="tabular-nums">{order.deliveryCostLabel}</dd>
					</div>
				)}
				<div className="flex items-baseline justify-between gap-4 text-row text-foreground">
					<dt>Total</dt>
					<dd className={cn("tabular-nums", order.isCancelled && "text-muted-foreground line-through")}>
						{order.totalLabel}
					</dd>
				</div>
			</dl>

			<div className="flex flex-wrap gap-2 pt-1 md:justify-end">
				<OrderInvoiceButton order={order} className="flex-1 md:flex-none" />
				{cancelAction}
			</div>
		</div>
	);
}
