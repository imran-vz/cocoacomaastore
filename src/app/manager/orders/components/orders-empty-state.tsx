import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

export function OrdersEmptyState({ className }: { className?: string }) {
	return (
		<div className={cn("rounded-xl border border-dashed bg-card px-5 py-12 text-center", className)}>
			<div className="mx-auto grid size-12 place-items-center rounded-full bg-muted">
				<Package className="size-6 text-muted-foreground" aria-hidden="true" />
			</div>
			<h2 className="mt-4 text-lg font-semibold">No orders yet</h2>
			<p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
				New orders will appear here when the counter completes a sale.
			</p>
		</div>
	);
}
