"use server";

import { performance } from "node:perf_hooks";
import { and, eq } from "drizzle-orm";
import { revalidateTag, unstable_cache } from "next/cache";

import { db } from "@/db";
import {
	dessertComboItemsTable,
	dessertCombosTable,
	dessertsTable,
} from "@/db/schema";
import { getServerSession } from "@/lib/auth";
import type { ComboWithDetails } from "@/lib/types";
import {
	createComboSchema,
	deleteComboSchema,
	updateComboItemsSchema,
	updateComboSchema,
} from "@/lib/validation";

async function requireManager() {
	const session = await getServerSession();
	if (!session?.session || !session?.user) {
		throw new Error("Unauthorized");
	}
	// Manager or Admin can access
	if (session.user.role !== "manager" && session.user.role !== "admin") {
		throw new Error("Manager access required");
	}
	return session.user;
}

// ============================================================================
// Read Operations
// ============================================================================

async function getAllCombos(): Promise<ComboWithDetails[]> {
	const start = performance.now();

	const combos = await db.query.dessertCombosTable.findMany({
		where: eq(dessertCombosTable.isDeleted, false),
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
	console.log(`getAllCombos: ${duration.toFixed(2)}ms`);

	return combos as ComboWithDetails[];
}

export const getCachedAllCombos = unstable_cache(getAllCombos, ["all-combos"], {
	revalidate: 60 * 60 * 24,
	tags: ["combos"],
});

async function getBaseDesserts() {
	const start = performance.now();

	const desserts = await db.query.dessertsTable.findMany({
		where: and(
			eq(dessertsTable.isDeleted, false),
			eq(dessertsTable.kind, "base"),
		),
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

export const getCachedBaseDesserts = unstable_cache(
	getBaseDesserts,
	["base-desserts"],
	{
		revalidate: 60 * 60 * 24,
		tags: ["desserts"],
	},
);

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

// ============================================================================
// Write Operations
// ============================================================================

export async function createCombo(data: {
	name: string;
	baseDessertId: number;
	overridePrice?: number | null;
	enabled?: boolean;
}) {
	await requireManager();

	const validated = createComboSchema.parse(data);

	const start = performance.now();

	const [newCombo] = await db
		.insert(dessertCombosTable)
		.values({
			name: validated.name,
			baseDessertId: validated.baseDessertId,
			overridePrice: validated.overridePrice ?? null,
			enabled: validated.enabled,
		})
		.returning({ id: dessertCombosTable.id });

	const duration = performance.now() - start;
	console.log(`createCombo: ${duration.toFixed(2)}ms`);

	revalidateTag("combos", "max");
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
	await requireManager();

	const validated = updateComboSchema.parse({ id, data });

	const start = performance.now();

	await db
		.update(dessertCombosTable)
		.set({
			name: validated.data.name,
			baseDessertId: validated.data.baseDessertId,
			overridePrice: validated.data.overridePrice,
			enabled: validated.data.enabled,
			updatedAt: new Date(),
		})
		.where(eq(dessertCombosTable.id, validated.id));

	const duration = performance.now() - start;
	console.log(`updateCombo: ${duration.toFixed(2)}ms`);

	revalidateTag("combos", "max");
}

export async function deleteCombo(id: number) {
	await requireManager();

	const validated = deleteComboSchema.parse({ id });

	const start = performance.now();

	await db
		.update(dessertCombosTable)
		.set({ isDeleted: true, updatedAt: new Date() })
		.where(eq(dessertCombosTable.id, validated.id));

	const duration = performance.now() - start;
	console.log(`deleteCombo: ${duration.toFixed(2)}ms`);

	revalidateTag("combos", "max");
}

export async function toggleCombo(id: number, enabled: boolean) {
	await requireManager();

	const start = performance.now();

	await db
		.update(dessertCombosTable)
		.set({ enabled, updatedAt: new Date() })
		.where(eq(dessertCombosTable.id, id));

	const duration = performance.now() - start;
	console.log(`toggleCombo: ${duration.toFixed(2)}ms`);

	revalidateTag("combos", "max");
}

export async function updateComboItems(
	comboId: number,
	items: Array<{ dessertId: number; quantity: number }>,
) {
	await requireManager();

	const validated = updateComboItemsSchema.parse({ comboId, items });

	const start = performance.now();

	await db.transaction(async (tx) => {
		// Delete existing items
		await tx
			.delete(dessertComboItemsTable)
			.where(eq(dessertComboItemsTable.comboId, validated.comboId));

		// Insert new items
		if (validated.items.length > 0) {
			await tx.insert(dessertComboItemsTable).values(
				validated.items.map((item) => ({
					comboId: validated.comboId,
					dessertId: item.dessertId,
					quantity: item.quantity,
				})),
			);
		}

		// Update combo timestamp
		await tx
			.update(dessertCombosTable)
			.set({ updatedAt: new Date() })
			.where(eq(dessertCombosTable.id, validated.comboId));
	});

	const duration = performance.now() - start;
	console.log(`updateComboItems: ${duration.toFixed(2)}ms`);

	revalidateTag("combos", "max");
}

export type BaseDessert = Awaited<ReturnType<typeof getBaseDesserts>>[number];
export type ModifierDessert = Awaited<
	ReturnType<typeof getModifierDesserts>
>[number];
