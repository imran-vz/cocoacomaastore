import "server-only";

import type { Area } from "@/features/access/area";
import { CombosCatalog } from "@/features/catalog/combos-catalog";
import { DessertsCatalog } from "@/features/catalog/desserts-catalog";
import { getCatalogDesserts, getComboCatalog } from "@/features/catalog/queries";
import { getTodayInventory } from "@/features/inventory/daily-inventory";
import { snapshot } from "@/lib/server-snapshot";

/** The Catalog's Desserts tab for `area`, rendered from the same reads its client queries refetch. */
export function DessertsRoute({ area }: { area: Area }) {
	return (
		<DessertsCatalog area={area} desserts={snapshot(getCatalogDesserts())} inventory={snapshot(getTodayInventory())} />
	);
}

/** The Catalog's Combos tab for `area`. */
export function CombosRoute({ area }: { area: Area }) {
	return <CombosCatalog area={area} catalog={snapshot(getComboCatalog())} />;
}
