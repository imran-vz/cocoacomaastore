import { snapshotRoute, staffRoute } from "@/features/access/route";
import { getTodayInventory } from "@/features/inventory/daily-inventory";

export const GET = snapshotRoute(staffRoute, getTodayInventory);
