import type { BusinessWeekTotals, DayTotals, MonthTotals, Totals } from "@/features/insights/shapes";
import {
	addDays,
	addMonths,
	type DayKey,
	dayKeyParts,
	daysBetween,
	type MonthKey,
	monthFirstDay,
	monthLastDay,
} from "@/lib/shop-calendar";

const TREND_DAYS = 7;
const TREND_MONTHS = 12;

const MONDAY = 1;
const TUESDAY = 2;
const NO_SALES: Totals = { revenue: 0, orders: 0 };

/** The days a series covers, inclusive: what a report reads totals for. */
export type DayRange = { first: DayKey; last: DayKey };

/** The days of the trend ending on `day`. */
export function dayTrendRange(day: DayKey): DayRange {
	return { first: addDays(day, 1 - TREND_DAYS), last: day };
}

/** The days of `month` that its Business Weeks are cut from. */
export function businessWeeksRange(month: MonthKey): DayRange {
	return { first: monthFirstDay(month), last: monthLastDay(month) };
}

/** The trend ending on `day`, with a zero row for every day without sales. */
export function dayTrend(day: DayKey, totals: ReadonlyMap<DayKey, Totals>): DayTotals[] {
	const { first, last } = dayTrendRange(day);
	return daysBetween(first, last).map((key) => ({ day: key, ...(totals.get(key) ?? NO_SALES) }));
}

/**
 * Up to `TREND_MONTHS` months ending on the latest month with data, with a zero row for
 * quiet months. A gap never pushes the latest month off the window.
 */
export function monthTrend(rows: readonly MonthTotals[]): MonthTotals[] {
	if (rows.length === 0) return [];
	const byMonth = new Map(rows.map((row) => [row.month, row]));
	const keys = [...byMonth.keys()].sort();
	const last = keys[keys.length - 1];
	const earliest = addMonths(last, 1 - TREND_MONTHS);
	const months: MonthTotals[] = [];
	for (let month = keys[0] > earliest ? keys[0] : earliest; month <= last; month = addMonths(month, 1)) {
		const { revenue, orders } = byMonth.get(month) ?? NO_SALES;
		months.push({ month, revenue, orders });
	}
	return months;
}

/**
 * The month's Business Weeks: Tuesday through Sunday, clipped to the month. Mondays belong
 * to no week, so their sales are left out.
 */
export function businessWeeks(month: MonthKey, totals: ReadonlyMap<DayKey, Totals>): BusinessWeekTotals[] {
	const weeks: BusinessWeekTotals[] = [];
	let week: BusinessWeekTotals | null = null;

	const { first, last } = businessWeeksRange(month);
	for (const day of daysBetween(first, last)) {
		const { weekday } = dayKeyParts(day);
		if (weekday === MONDAY) {
			week = null;
			continue;
		}
		if (!week || weekday === TUESDAY) {
			week = { index: weeks.length + 1, firstDay: day, lastDay: day, revenue: 0, orders: 0 };
			weeks.push(week);
		}
		const { revenue, orders } = totals.get(day) ?? NO_SALES;
		week.lastDay = day;
		week.revenue += revenue;
		week.orders += orders;
	}

	return weeks;
}
