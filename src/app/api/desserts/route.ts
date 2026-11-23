import { snapshotRoute, staffRoute } from "@/features/access/route";
import { getCatalogDesserts } from "@/features/catalog/queries";

export const GET = snapshotRoute(staffRoute, getCatalogDesserts);
