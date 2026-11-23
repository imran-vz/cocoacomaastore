import { snapshotRoute, staffRoute } from "@/features/access/route";
import { getComboCatalog } from "@/features/catalog/queries";

export const GET = snapshotRoute(staffRoute, getComboCatalog);
