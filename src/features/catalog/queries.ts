import "server-only";

import { and, asc, eq, type SQL } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { dessertCombosTable, dessertsTable } from "@/db/schema";
import { requireStaff } from "@/features/access/session";
import { COMBO_READ_TAGS, DESSERT_TAGS } from "@/features/catalog/tags";
import { TAGGED_READ_REVALIDATE_SECONDS } from "@/lib/cache-tags";

/** Sell-screen order of desserts. */
export const sellOrder = [asc(dessertsTable.sequence), asc(dessertsTable.id)];

const cachedDesserts = unstable_cache(
	(includeHidden: boolean) =>
		db
			.select()
			.from(dessertsTable)
			.where(and(eq(dessertsTable.isDeleted, false), includeHidden ? undefined : eq(dessertsTable.enabled, true)))
			.orderBy(...sellOrder),
	["catalog-desserts"],
	{ revalidate: TAGGED_READ_REVALIDATE_SECONDS, tags: DESSERT_TAGS },
);

export type Dessert = Awaited<ReturnType<typeof cachedDesserts>>[number];

/** The desserts listed on the Sell screen, in its order. */
export async function getDesserts(): Promise<Dessert[]> {
	await requireStaff();
	return cachedDesserts(false);
}

/** Every dessert in the catalog, hidden ones included, in Sell-screen order: the Desserts tab's list. */
export async function getCatalogDesserts(): Promise<Dessert[]> {
	await requireStaff();
	return cachedDesserts(true);
}

const availabilityColumns = { kind: true, enabled: true, isDeleted: true, isOutOfStock: true } as const;

function queryCombos(where: SQL | undefined) {
	return db.query.dessertCombosTable.findMany({
		where,
		orderBy: (combos, { asc }) => [asc(combos.id)],
		columns: { id: true, name: true, baseDessertId: true, overridePrice: true, enabled: true, isDeleted: true },
		with: {
			baseDessert: { columns: { id: true, name: true, price: true, hasUnlimitedStock: true, ...availabilityColumns } },
			items: {
				columns: { id: true, dessertId: true, quantity: true },
				with: { dessert: { columns: { id: true, name: true, price: true, ...availabilityColumns } } },
			},
		},
	});
}

export type ComboWithDetails = Awaited<ReturnType<typeof queryCombos>>[number];

const cachedEnabledCombos = unstable_cache(
	() => queryCombos(and(eq(dessertCombosTable.isDeleted, false), eq(dessertCombosTable.enabled, true))),
	["catalog-enabled-combos"],
	{ revalidate: TAGGED_READ_REVALIDATE_SECONDS, tags: COMBO_READ_TAGS },
);

/** Combos switched on for the Sell screen (whose desserts may still be off sale). */
export async function getEnabledCombos(): Promise<ComboWithDetails[]> {
	await requireStaff();
	return cachedEnabledCombos();
}

function queryComboChoices(kind: "base" | "modifier") {
	return db
		.select({
			id: dessertsTable.id,
			name: dessertsTable.name,
			price: dessertsTable.price,
		})
		.from(dessertsTable)
		.where(and(eq(dessertsTable.isDeleted, false), eq(dessertsTable.enabled, true), eq(dessertsTable.kind, kind)))
		.orderBy(...sellOrder);
}

export type ComboChoice = Awaited<ReturnType<typeof queryComboChoices>>[number];

const cachedComboCatalog = unstable_cache(
	async () => {
		const [combos, bases, addOns] = await Promise.all([
			queryCombos(eq(dessertCombosTable.isDeleted, false)),
			queryComboChoices("base"),
			queryComboChoices("modifier"),
		]);
		return { combos, bases, addOns };
	},
	["catalog-combos"],
	{ revalidate: TAGGED_READ_REVALIDATE_SECONDS, tags: COMBO_READ_TAGS },
);

/** Everything the Combos screen shows and edits: every combo, plus the desserts a combo can be built from. */
export type ComboCatalog = Awaited<ReturnType<typeof cachedComboCatalog>>;

export async function getComboCatalog(): Promise<ComboCatalog> {
	await requireStaff();
	return cachedComboCatalog();
}
