import type { ChartSlot } from "./bar-chart";

/**
 * Sales by hour for one shop day, built from the orders the existing admin orders read
 * already returns for that day (`/api/admin/orders?date=…`), so no extra query exists.
 * Revenue counts completed orders only, the same rule as the day's Revenue figure.
 */

/** India has no daylight saving: shop time is always UTC+5:30. */
const SHOP_OFFSET_MINUTES = 5 * 60 + 30;
/** The narrowest window the chart draws, so one busy hour still reads as part of a day. */
const MIN_HOURS = 8;

export type HourSlot = ChartSlot & { hour: number };

type OrderLike = { createdAt: string; status: string; total: string | number };

/** 0–23, the shop-time hour an instant falls in. */
export function shopHour(isoTimestamp: string): number {
	const minutes = Math.floor(Date.parse(isoTimestamp) / 60_000) + SHOP_OFFSET_MINUTES;
	return Math.floor((((minutes % 1440) + 1440) % 1440) / 60);
}

/** `0` → "12 AM", `13` → "1 PM". */
export function hourLabel(hour: number): string {
	const normalized = ((hour % 24) + 24) % 24;
	const hour12 = normalized % 12 === 0 ? 12 : normalized % 12;
	return `${hour12} ${normalized < 12 ? "AM" : "PM"}`;
}

/** `13` → "1–2 PM", `11` → "11 AM–12 PM". */
export function hourRangeLabel(hour: number): string {
	const start = hourLabel(hour);
	const end = hourLabel(hour + 1);
	const [startNumber, startSuffix] = start.split(" ");
	return startSuffix === end.split(" ")[1] ? `${startNumber}–${end}` : `${start}–${end}`;
}

/**
 * One slot per hour from the first to the last hour with sales, widened to at least
 * `MIN_HOURS` (later hours first, then earlier ones) so quiet hours in between still show.
 * Returns no slots when the day has no completed orders.
 */
export function buildHourSlots(orders: readonly OrderLike[]): HourSlot[] {
	const totals = new Map<number, { revenue: number; orders: number }>();
	for (const order of orders) {
		if (order.status !== "completed") continue;
		const hour = shopHour(order.createdAt);
		const entry = totals.get(hour) ?? { revenue: 0, orders: 0 };
		entry.revenue += Number(order.total) || 0;
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
			axisLabel: hourLabel(hour),
			revenue: entry?.revenue ?? 0,
			orders: entry?.orders ?? 0,
		};
	});
}
