import { EmptyState } from "@/components/ui/empty-state";

export function OrdersEmptyState({ isToday }: { isToday: boolean }) {
	return isToday ? (
		<EmptyState
			variant="block"
			title="No orders yet"
			description="New orders will appear here when the counter completes a sale."
		/>
	) : (
		<EmptyState variant="block" title="No orders" description="No orders were placed on this day." />
	);
}
