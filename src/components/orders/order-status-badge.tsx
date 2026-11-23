import { Badge } from "@/components/ui/badge";
import type { OrderViewModel } from "./orders-view-model";

/**
 * Status only when it is an exception (DESIGN.md §Badges): completed orders render nothing,
 * cancelled orders get the destructive badge, pending a neutral outline badge.
 */
export function OrderStatusBadge({ order, className }: { order: OrderViewModel; className?: string }) {
	if (order.isCancelled) {
		return (
			<Badge variant="destructive" className={className}>
				{order.statusLabel}
			</Badge>
		);
	}
	if (order.status === "pending") {
		return (
			<Badge variant="outline" className={className}>
				{order.statusLabel}
			</Badge>
		);
	}
	return null;
}
