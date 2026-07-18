import { performance } from "node:perf_hooks";
import { and, eq, type SQL } from "drizzle-orm";
import { Effect } from "effect";
import { unstable_cache } from "next/cache";

import { db } from "@/db";
import { dessertComboItemsTable, dessertCombosTable, dessertsTable } from "@/db/schema";
import type { ComboWithDetails } from "@/lib/types";
import { createComboSchema, deleteComboSchema, updateComboItemsSchema, updateComboSchema } from "@/lib/validation";
import { CacheTag, updateComboTagsEffect } from "@/server/effect/cache-tags";
import { runNextAppEffect } from "@/server/effect/next-runtime";
import { Database } from "@/server/effect/services/db";

// ============================================================================
// Read Operations
// ============================================================================

const comboDetailsWith = {
	baseDessert: {
		columns: {
			id: true,
			name: true,
			price: true,
			enabled: true,
			isDeleted: true,
			isOutOfStock: true,
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
					enabled: true,
					isDeleted: true,
					isOutOfStock: true,
				},
			},
		},
	},
} as const;

async function queryCombos(label: string, where: SQL | undefined): Promise<ComboWithDetails[]> {
	const start = performance.now();

	const combos = await db.query.dessertCombosTable.findMany({
		where,
		orderBy: (combos, { asc }) => [asc(combos.sequence)],
		with: comboDetailsWith,
	});

	const duration = performance.now() - start;
	console.log(`${label}: ${duration.toFixed(2)}ms`);

	return combos as ComboWithDetails[];
}

async function getAllCombos(): Promise<ComboWithDetails[]> {
	return queryCombos("getAllCombos", eq(dessertCombosTable.isDeleted, false));
}

export async function getEnabledCombos(): Promise<ComboWithDetails[]> {
	return queryCombos(
		"getEnabledCombos",
		and(eq(dessertCombosTable.isDeleted, false), eq(dessertCombosTable.enabled, true)),
	);
}

export const getCachedAllCombos = unstable_cache(getAllCombos, ["all-combos"], {
	revalidate: 60 * 60 * 24,
	tags: [CacheTag.combos],
});

async function getBaseDesserts() {
	const start = performance.now();

	const desserts = await db.query.dessertsTable.findMany({
		where: and(eq(dessertsTable.isDeleted, false), eq(dessertsTable.enabled, true), eq(dessertsTable.kind, "base")),
		orderBy: (desserts, { asc }) => [asc(desserts.sequence)],
		columns: {
			id: true,
			name: true,
			price: true,
			hasUnlimitedStock: true,
		},
	});

	const duration = performance.now() - start;
	console.log(`getBaseDesserts: ${duration.toFixed(2)}ms`);

	return desserts;
}

export const getCachedBaseDesserts = unstable_cache(getBaseDesserts, ["base-desserts"], {
	revalidate: 60 * 60 * 24,
	tags: [CacheTag.desserts],
});

async function getModifierDesserts() {
	const start = performance.now();

	const modifiers = await db.query.dessertsTable.findMany({
		where: and(eq(dessertsTable.isDeleted, false), eq(dessertsTable.enabled, true), eq(dessertsTable.kind, "modifier")),
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

export const getCachedModifierDesserts = unstable_cache(getModifierDesserts, ["modifier-desserts"], {
	revalidate: 60 * 60 * 24,
	tags: [CacheTag.desserts],
});

// ============================================================================
// Write Operations
// ============================================================================

export async function createCombo(data: {
	name: string;
	baseDessertId: number;
	overridePrice?: number | null;
	enabled?: boolean;
}) {
	const validated = createComboSchema.parse(data);

	const start = performance.now();

	const [newCombo] = await runNextAppEffect(
		Effect.gen(function* () {
			const database = yield* Database;
			const combo = yield* database.attempt(
				"create combo",
				async (db) =>
					await db
						.insert(dessertCombosTable)
						.values({
							name: validated.name,
							baseDessertId: validated.baseDessertId,
							overridePrice: validated.overridePrice ?? null,
							enabled: validated.enabled,
						})
						.returning({ id: dessertCombosTable.id }),
			);
			yield* updateComboTagsEffect();

			return combo;
		}),
	);

	const duration = performance.now() - start;
	console.log(`createCombo: ${duration.toFixed(2)}ms`);
	return newCombo;
}

export async function updateCombo(
	id: number,
	data: {
		name: string;
		baseDessertId: number;
		overridePrice: number | null;
		enabled: boolean;
	},
) {
	const validated = updateComboSchema.parse({ id, data });

	const start = performance.now();

	await runNextAppEffect(
		Effect.gen(function* () {
			const database = yield* Database;
			yield* database.attempt("update combo", (db) =>
				db
					.update(dessertCombosTable)
					.set({
						name: validated.data.name,
						baseDessertId: validated.data.baseDessertId,
						overridePrice: validated.data.overridePrice,
						enabled: validated.data.enabled,
						updatedAt: new Date(),
					})
					.where(eq(dessertCombosTable.id, validated.id)),
			);
			yield* updateComboTagsEffect();
		}),
	);

	const duration = performance.now() - start;
	console.log(`updateCombo: ${duration.toFixed(2)}ms`);
}

export async function deleteCombo(id: number) {
	const validated = deleteComboSchema.parse({ id });

	const start = performance.now();

	await runNextAppEffect(
		Effect.gen(function* () {
			const database = yield* Database;
			yield* database.attempt("delete combo", (db) =>
				db
					.update(dessertCombosTable)
					.set({ isDeleted: true, updatedAt: new Date() })
					.where(eq(dessertCombosTable.id, validated.id)),
			);
			yield* updateComboTagsEffect();
		}),
	);

	const duration = performance.now() - start;
	console.log(`deleteCombo: ${duration.toFixed(2)}ms`);
}

export async function toggleCombo(id: number, enabled: boolean) {
	const start = performance.now();

	await runNextAppEffect(
		Effect.gen(function* () {
			const database = yield* Database;
			yield* database.attempt("toggle combo", (db) =>
				db.update(dessertCombosTable).set({ enabled, updatedAt: new Date() }).where(eq(dessertCombosTable.id, id)),
			);
			yield* updateComboTagsEffect();
		}),
	);

	const duration = performance.now() - start;
	console.log(`toggleCombo: ${duration.toFixed(2)}ms`);
}

export async function updateComboItems(comboId: number, items: Array<{ dessertId: number; quantity: number }>) {
	const validated = updateComboItemsSchema.parse({ comboId, items });

	const start = performance.now();

	await runNextAppEffect(
		Effect.gen(function* () {
			const database = yield* Database;
			yield* database.attempt("update combo items", (db) =>
				db.transaction(async (tx) => {
					const [combo] = await tx
						.select({ id: dessertCombosTable.id, isDeleted: dessertCombosTable.isDeleted })
						.from(dessertCombosTable)
						.where(eq(dessertCombosTable.id, validated.comboId))
						.for("no key update");

					if (!combo || combo.isDeleted) {
						throw new Error("Combo is missing or inactive");
					}

					await tx.delete(dessertComboItemsTable).where(eq(dessertComboItemsTable.comboId, validated.comboId));

					if (validated.items.length > 0) {
						await tx.insert(dessertComboItemsTable).values(
							validated.items.map((item) => ({
								comboId: validated.comboId,
								dessertId: item.dessertId,
								quantity: item.quantity,
							})),
						);
					}

					await tx
						.update(dessertCombosTable)
						.set({ updatedAt: new Date() })
						.where(eq(dessertCombosTable.id, validated.comboId));
				}),
			);
			yield* updateComboTagsEffect();
		}),
	);

	const duration = performance.now() - start;
	console.log(`updateComboItems: ${duration.toFixed(2)}ms`);
}

// ============================================================================
// Types
// ============================================================================

export type BaseDessert = Awaited<ReturnType<typeof getBaseDesserts>>[number];
export type ModifierDessert = Awaited<ReturnType<typeof getModifierDesserts>>[number];
