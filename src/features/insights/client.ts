import type { AnalyticsOverview, BusinessWeekTotals, DashboardReport, DessertSales } from "@/features/insights/shapes";
import { COMPILED_TAGS, DESSERT_SALES_TAGS, dayReportTags } from "@/features/insights/tags";
import type { DayKey, MonthKey } from "@/lib/shop-calendar";
import { snapshotQuery } from "@/lib/snapshot-query";

const HOUR_MS = 60 * 60 * 1000;
/** Month figures change only when the analytics job compiles a closed period. */
const COMPILED = { staleTime: HOUR_MS, gcTime: 2 * HOUR_MS };

/** The search param of the day Insights › Day shows, on the page and its API route alike. */
export const REPORT_DAY_PARAM = "date";

/** Served by the routes under src/app/api/admin/. */
export const insightsQueries = {
	day: (day: DayKey, today: DayKey) =>
		snapshotQuery<DashboardReport>(`/api/admin/dashboard?${REPORT_DAY_PARAM}=${day}`, {
			queryKey: ["insights", "day", day],
			tags: dayReportTags(day, today),
		}),
	overview: () =>
		snapshotQuery<AnalyticsOverview>("/api/admin/analytics/overview", {
			queryKey: ["insights", "overview"],
			tags: COMPILED_TAGS,
			...COMPILED,
		}),
	dessertSales: (month: MonthKey) =>
		snapshotQuery<DessertSales[]>(`/api/admin/analytics/monthly-dessert-revenue?month=${month}`, {
			queryKey: ["insights", "dessert-sales", month],
			tags: DESSERT_SALES_TAGS,
			...COMPILED,
		}),
	businessWeeks: (month: MonthKey | null) =>
		snapshotQuery<BusinessWeekTotals[]>(month ? `/api/admin/analytics/weekly-revenue?month=${month}` : null, {
			queryKey: ["insights", "business-weeks", month],
			tags: COMPILED_TAGS,
			...COMPILED,
		}),
};
