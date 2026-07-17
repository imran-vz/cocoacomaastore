import { cn } from "@/lib/utils";
import type { ManagerOrderViewModel } from "../orders-view-model";
import type { CancelOrderHandler } from "../use-manager-orders-controller";
import { OrderActions } from "./order-actions";
import { OrderLineItems } from "./order-line-items";

export function OrderDetailPanel({
	order,
	onCancelOrder,
	className,
}: {
	order: ManagerOrderViewModel;
	onCancelOrder: CancelOrderHandler;
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

			<OrderActions order={order} onCancelOrder={onCancelOrder} />
		</div>
	);
}
