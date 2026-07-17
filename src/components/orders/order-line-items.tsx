import { cn } from "@/lib/utils";
import type { OrderViewModel } from "./orders-view-model";

export function OrderLineItems({ order, className }: { order: OrderViewModel; className?: string }) {
	return (
		<ul className={cn("divide-y", className)}>
			{order.lines.map((line) => (
				<li key={line.id} className="grid grid-cols-[1fr_auto] gap-x-3 py-2">
					<div className="min-w-0">
						<p className={cn("font-medium", line.isCombo && "text-primary")}>{line.name}</p>
						{line.baseDessertName && (
							<p className="mt-0.5 text-xs text-muted-foreground">Base: {line.baseDessertName}</p>
						)}
						{line.modifiers.length > 0 && (
							<ul className="mt-1 space-y-0.5 border-l-2 pl-2 text-xs text-muted-foreground">
								{line.modifiers.map((modifier) => (
									<li key={modifier.id}>
										{modifier.name}
										{modifier.quantity > 1 ? ` ×${modifier.quantity}` : ""}
									</li>
								))}
							</ul>
						)}
					</div>
					<div className="text-right">
						<span className="font-mono font-medium tabular-nums">×{line.quantity}</span>
					</div>
				</li>
			))}
		</ul>
	);
}
