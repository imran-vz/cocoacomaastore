import type { ReactNode } from "react";
import { OrderInvoiceButton } from "@/components/order-invoice-button";
import { cn } from "@/lib/utils";
import { OrderLineItems } from "./order-line-items";
import type { OrderViewModel } from "./orders-view-model";

export function OrderDetailPanel({
	order,
	cancelAction,
	className,
}: {
	order: OrderViewModel;
	cancelAction?: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("space-y-3", className)}>
			<OrderLineItems order={order} />

			<div className="space-y-1.5 border-t pt-3 text-sm">
				{order.deliveryCostLabel && (
					<div className="flex items-center justify-between gap-4 text-muted-foreground">
						<span>Delivery</span>
						<span className="font-mono tabular-nums">{order.deliveryCostLabel}</span>
					</div>
				)}
				<div className="flex items-center justify-between gap-4 font-semibold">
					<span>Order total</span>
					<span className="font-mono text-base tabular-nums">{order.totalLabel}</span>
				</div>
			</div>

			<div className={cn("grid gap-2", cancelAction && "sm:grid-cols-2")}>
				<OrderInvoiceButton order={order.source} className="h-11 md:h-8" />
				{cancelAction}
			</div>
		</div>
	);
}
