import type { ChartSlot } from "@/features/insights/chart-slots";
import type { OrderRecord } from "@/features/orders/contract";
import { isSale } from "@/features/orders/sale";
import { formatHour } from "@/lib/format";
import { rupees, toCents } from "@/lib/money";
import { shopParts } from "@/lib/shop-calendar";

/** The narrowest window the chart draws, so one busy hour still reads as part of a day. */
const MIN_HOURS = 8;

export type HourSlot = ChartSlot & { hour: number };

type OrderLike = Pick<OrderRecord, "createdAt" | "status" | "total">;

/**
 * Sales by shop-time hour, from the first to the last hour with sales, widened to at least
 * `MIN_HOURS` (later hours first) so quiet hours in between still show. Only completed
 * orders count, the same rule as the day's Revenue figure; the orders read already leaves
 * out deleted ones.
 */
export function buildHourSlots(orders: readonly OrderLike[]): HourSlot[] {
	const totals = new Map<number, { revenueCents: number; orders: number }>();
	for (const order of orders) {
		if (!isSale(order)) continue;
		const { hour } = shopParts(new Date(order.createdAt));
		const entry = totals.get(hour) ?? { revenueCents: 0, orders: 0 };
		entry.revenueCents += toCents(order.total);
		entry.orders += 1;
		totals.set(hour, entry);
	}
	if (totals.size === 0) return [];

	const hours = [...totals.keys()];
	let first = Math.min(...hours);
	let last = Math.max(...hours);
	while (last - first + 1 < MIN_HOURS) {
		if (last < 23) last += 1;
		else if (first > 0) first -= 1;
		else break;
	}

	return Array.from({ length: last - first + 1 }, (_, index) => {
		const hour = first + index;
		const entry = totals.get(hour);
		return {
			key: String(hour),
			hour,
			axisLabel: formatHour(hour),
			revenue: rupees(entry?.revenueCents ?? 0),
			orders: entry?.orders ?? 0,
		};
	});
}
