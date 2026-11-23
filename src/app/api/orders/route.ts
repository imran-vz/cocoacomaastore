import { snapshotRoute, staffRoute } from "@/features/access/route";
import { getDayOrders } from "@/features/orders/queries";
import { parseDayKey } from "@/lib/shop-calendar";

export const GET = snapshotRoute(staffRoute, getDayOrders, { param: "date", parse: parseDayKey });
