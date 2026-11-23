import { EmptyState } from "@/components/ui/empty-state";

/** A day without orders: the shared block empty state (decision 8). */
export function OrdersEmptyState({
	className,
	title = "No orders yet",
	description = "New orders will appear here when the counter completes a sale.",
}: {
	className?: string;
	title?: string;
	description?: string;
}) {
	return <EmptyState variant="block" title={title} description={description} className={className} />;
}
