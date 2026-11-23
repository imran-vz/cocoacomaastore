import type { ComboCatalog, Dessert } from "@/features/catalog/queries";
import { COMBO_READ_TAGS, DESSERT_TAGS } from "@/features/catalog/tags";
import { snapshotQuery } from "@/lib/snapshot-query";

/** Every dessert in the catalog, hidden ones included. Served by src/app/api/desserts/route.ts. */
export const dessertsQuery = snapshotQuery<Dessert[]>("/api/desserts", {
	queryKey: ["catalog", "desserts"],
	tags: DESSERT_TAGS,
});

/** Served by src/app/api/combos/route.ts. */
export const comboCatalogQuery = snapshotQuery<ComboCatalog>("/api/combos", {
	queryKey: ["catalog", "combos"],
	tags: COMBO_READ_TAGS,
});
