import { adminRoute, snapshotRoute } from "@/features/access/route";
import { getDessertSales } from "@/features/insights/reporting";
import { parseMonthKey } from "@/lib/shop-calendar";

export const GET = snapshotRoute(adminRoute, getDessertSales, { param: "month", parse: parseMonthKey });
