import { Stat, StatGrid } from "@/components/ui/stat";
import type { OrdersView } from "@/features/orders/presentation";
import { formatNumber } from "@/lib/format";

const CELL = "px-3 py-2.5 md:px-4 md:py-3";
const VALUE = "text-xl leading-7 md:text-2xl md:leading-8";

/** Orders · Items sold, and Revenue (the same figure as Insights) when the area shows it. */
export function OrdersSummary({ model, showRevenue }: { model: OrdersView; showRevenue: boolean }) {
	return (
		<StatGrid aria-label="Order summary" className={showRevenue ? "grid-cols-3" : "grid-cols-2"}>
			<Stat className={CELL} valueClassName={VALUE} label="Orders" value={formatNumber(model.totalOrders)} />
			<Stat className={CELL} valueClassName={VALUE} label="Items sold" value={formatNumber(model.itemsSold)} />
			{showRevenue ? <Stat className={CELL} valueClassName={VALUE} label="Revenue" value={model.revenueLabel} /> : null}
		</StatGrid>
	);
}
