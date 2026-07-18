import { getCachedWeeklyRevenue } from "@/app/admin/dashboard/actions";
import { createMonthlyAnalyticsGET } from "@/lib/monthly-analytics-route";

export const GET = createMonthlyAnalyticsGET(getCachedWeeklyRevenue);
