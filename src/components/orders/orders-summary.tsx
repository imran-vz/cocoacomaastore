import { Stat, StatGrid } from "@/components/admin/dashboard/stats-card";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrdersViewModel } from "./orders-view-model";

export type OrdersSummaryMetric = {
	label: string;
	value: string | number;
};

/** The Orders summary strip: Orders · Items sold (· Revenue for admins, the same label as Insights). */
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
		{ label: "Orders", value: formatNumber(model.totalOrders) },
		{ label: "Items sold", value: formatNumber(model.itemsSold) },
		...(additionalMetric ? [additionalMetric] : []),
	];

	return (
		<StatGrid aria-label="Order summary" className={cn(additionalMetric ? "grid-cols-3" : "grid-cols-2", className)}>
			{metrics.map((metric) => (
				<Stat key={metric.label} size="compact" label={metric.label} value={metric.value} />
			))}
		</StatGrid>
	);
}
