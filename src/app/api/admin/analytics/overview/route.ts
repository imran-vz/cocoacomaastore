import { adminRoute, snapshotRoute } from "@/features/access/route";
import { getAnalyticsOverview } from "@/features/insights/reporting";

export const GET = snapshotRoute(adminRoute, getAnalyticsOverview);
