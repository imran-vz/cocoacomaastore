import { Badge } from "@/components/ui/badge";
import type { OrderView } from "@/features/orders/presentation";

/** Status shows only when it is an exception (DESIGN.md §Badges): a cancelled order. */
export function OrderStatusBadge({ order }: { order: OrderView }) {
	if (!order.isCancelled) return null;
	return <Badge variant="destructive">{order.statusLabel}</Badge>;
}
