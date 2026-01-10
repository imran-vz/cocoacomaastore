"use server";

import { performance } from "node:perf_hooks";
import { and, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { db } from "@/db";
import { dessertCombosTable, dessertsTable } from "@/db/schema";
import type { ComboWithDetails } from "@/lib/types";

/**
 * Fetches all enabled combos with their details for UI display.
 */
async function getCombos(): Promise<ComboWithDetails[]> {
	const start = performance.now();

	const combos = await db.query.dessertCombosTable.findMany({
		where: and(
			eq(dessertCombosTable.isDeleted, false),
			eq(dessertCombosTable.enabled, true),
		),
		orderBy: (combos, { asc }) => [asc(combos.sequence)],
		with: {
			baseDessert: {
				columns: {
					id: true,
					name: true,
					price: true,
					hasUnlimitedStock: true,
				},
			},
			items: {
				with: {
					dessert: {
						columns: {
							id: true,
							name: true,
							price: true,
						},
					},
				},
			},
		},
	});

	const duration = performance.now() - start;
	console.log(`getCombos: ${duration.toFixed(2)}ms`);

	return combos as ComboWithDetails[];
}

export const getCachedCombos = unstable_cache(getCombos, ["combos"], {
	revalidate: 60 * 60 * 24,
	tags: ["combos"],
});

/**
 * Fetches all modifier desserts for variant building UI.
 */
async function getModifierDesserts() {
	const start = performance.now();

	const modifiers = await db.query.dessertsTable.findMany({
		where: and(
			eq(dessertsTable.isDeleted, false),
			eq(dessertsTable.enabled, true),
			eq(dessertsTable.kind, "modifier"),
		),
		orderBy: (desserts, { asc }) => [asc(desserts.sequence)],
		columns: {
			id: true,
			name: true,
			price: true,
		},
	});

	const duration = performance.now() - start;
	console.log(`getModifierDesserts: ${duration.toFixed(2)}ms`);

	return modifiers;
}

export const getCachedModifierDesserts = unstable_cache(
	getModifierDesserts,
	["modifier-desserts"],
	{
		revalidate: 60 * 60 * 24,
		tags: ["desserts"],
	},
);

export type ModifierDessert = Awaited<ReturnType<typeof getModifierDesserts>>[number];
