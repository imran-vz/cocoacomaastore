import { Badge } from "@/components/ui/badge";
import type { OrderViewModel } from "./orders-view-model";

export function OrderStatusBadge({ order, className }: { order: OrderViewModel; className?: string }) {
	return (
		<Badge
			variant={order.isCancelled ? "destructive" : order.status === "pending" ? "outline" : "secondary"}
			className={className}
		>
			{order.statusLabel}
		</Badge>
	);
}
