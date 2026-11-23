import type { DessertStock, StockChanges } from "@/features/inventory/shapes";
import type { DayKey, MonthKey } from "@/lib/shop-calendar";

export type Totals = {
	revenue: number;
	orders: number;
};

export type DayTotals = Totals & { day: DayKey };

export type MonthTotals = Totals & { month: MonthKey };

/** A Tuesday–Sunday reporting week, clipped to its month. `index` counts from 1. */
export type BusinessWeekTotals = Totals & {
	index: number;
	firstDay: DayKey;
	lastDay: DayKey;
};

export type DessertSales = {
	dessertId: number;
	dessertName: string;
	revenue: number;
	quantitySold: number;
};

export type DashboardReport = {
	day: DayKey;
	/** The shop's today when the server read the report. */
	today: DayKey;
	/** The day is still trading, so its figures are live and not yet comparable with closed days. */
	isLive: boolean;
	totals: Totals & { itemsSold: number };
	/** Every day of the trend window ending on `day`, oldest first. */
	trend: DayTotals[];
	stock: DessertStock[];
	stockChanges: StockChanges;
};

export type AnalyticsOverview = {
	/** Every month of the trend window ending on the latest compiled month, oldest first. */
	months: MonthTotals[];
	/** Compiled months, newest first. */
	compiledMonths: MonthKey[];
	/** The month the page opens on. */
	latestMonth: MonthKey;
};
