import { adminRoute, snapshotRoute } from "@/features/access/route";
import { getBusinessWeekRevenue } from "@/features/insights/reporting";
import { parseMonthKey } from "@/lib/shop-calendar";

export const GET = snapshotRoute(adminRoute, getBusinessWeekRevenue, { param: "month", parse: parseMonthKey });
