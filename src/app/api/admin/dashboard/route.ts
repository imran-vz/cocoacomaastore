import { adminRoute, snapshotRoute } from "@/features/access/route";
import { getDashboardReport } from "@/features/insights/reporting";
import { parseDayKey } from "@/lib/shop-calendar";

export const GET = snapshotRoute(adminRoute, getDashboardReport, { param: "date", parse: parseDayKey });
