import type { LucideIcon } from "lucide-react";
import { PackageCheck, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrdersViewModel } from "./orders-view-model";

export type OrdersSummaryMetric = {
	label: string;
	value: string | number;
	icon: LucideIcon;
};

export function OrdersSummary({
	model,
	additionalMetric,
	className,
}: {
	model: OrdersViewModel;
	additionalMetric?: OrdersSummaryMetric;
	className?: string;
}) {
	const metrics: OrdersSummaryMetric[] = [
		{ label: "Orders placed", value: model.totalOrders, icon: ShoppingBag },
		{ label: "Items sold", value: model.itemsSold, icon: PackageCheck },
		...(additionalMetric ? [additionalMetric] : []),
	];

	return (
		<dl className={cn("grid gap-4 border-y py-3", additionalMetric ? "grid-cols-3" : "grid-cols-2", className)}>
			{metrics.map((metric) => (
				<div key={metric.label} className="min-w-0">
					<dt className="flex items-center gap-1.5 text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase sm:text-xs">
						<metric.icon className="hidden size-3.5 sm:block" aria-hidden="true" />
						<span className="truncate">{metric.label}</span>
					</dt>
					<dd className="mt-1 truncate font-mono text-lg font-semibold tabular-nums sm:text-xl">{metric.value}</dd>
				</div>
			))}
		</dl>
	);
}
