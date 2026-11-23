import { cn } from "@/lib/utils";
import type { OrderViewModel } from "./orders-view-model";

/** `2 × Name` on the left, the line amount on the right (Shopify POS order detail). */
export function OrderLineItems({ order, className }: { order: OrderViewModel; className?: string }) {
	return (
		<ul className={cn("space-y-2.5", className)} aria-label={`Items in order ${order.orderLabel}`}>
			{order.lines.map((line) => (
				<li key={line.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 text-sm">
					<div className="min-w-0">
						<p className="font-medium text-foreground">
							<span className="tabular-nums text-muted-foreground">{line.quantity} ×</span> {line.name}
						</p>
						{line.baseDessertName || line.modifiers.length > 0 ? (
							<p className="mt-0.5 text-[13px] leading-[18px] text-muted-foreground">
								{[
									line.baseDessertName,
									...line.modifiers.map(
										(modifier) => `${modifier.name}${modifier.quantity > 1 ? ` ×${modifier.quantity}` : ""}`,
									),
								]
									.filter(Boolean)
									.join(" + ")}
							</p>
						) : null}
					</div>
					<span className="text-right tabular-nums text-foreground">{line.lineTotalLabel}</span>
				</li>
			))}
		</ul>
	);
}
