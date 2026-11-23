import type { OrderView } from "@/features/orders/presentation";

/** `2 × Name` on the left, the line amount on the right. */
export function OrderLineItems({ order }: { order: OrderView }) {
	return (
		<ul className="space-y-2.5" aria-label={`Items in order ${order.orderLabel}`}>
			{order.lines.map((line) => (
				<li key={line.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 text-sm">
					<div className="min-w-0">
						<p className="font-medium text-foreground">
							<span className="tabular-nums text-muted-foreground">{line.quantity} ×</span> {line.name}
						</p>
						{line.contents.length > 0 ? (
							<p className="mt-0.5 text-meta text-muted-foreground">{line.contents.join(" + ")}</p>
						) : null}
					</div>
					<span className="text-right tabular-nums text-foreground">{line.lineTotalLabel}</span>
				</li>
			))}
		</ul>
	);
}
