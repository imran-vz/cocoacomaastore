"use server";

import { and, eq, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { dessertsTable } from "@/db/schema";
import { requireSession as requireAuth } from "@/lib/auth/guards";
import { sanitizeDescription } from "@/lib/sanitize";
import { initializeSequence, updateSequence } from "@/lib/sequence";
import type { Dessert } from "@/lib/types";
import {
	createDessertSchema,
	deleteDessertSchema,
	toggleDessertSchema,
	toggleOutOfStockSchema,
	updateDessertSchema,
	updateDessertSequenceSchema,
} from "@/lib/validation";
import { CacheTag, updateDessertTagsEffect } from "@/server/effect/cache-tags";
import { runNextAppEffect } from "@/server/effect/next-runtime";

async function getDesserts({ shouldShowDisabled = false }: { shouldShowDisabled?: boolean } = {}) {
	// Get desserts from database, sorted by sequence
	const desserts = await db.query.dessertsTable.findMany({
		where: and(eq(dessertsTable.isDeleted, false), shouldShowDisabled ? undefined : eq(dessertsTable.enabled, true)),
		orderBy: (desserts, { asc }) => [asc(desserts.sequence)],
	});

	return desserts;
}

export async function toggleDessert(id: number, enabled: boolean) {
	await requireAuth();

	// Validate input
	const validated = toggleDessertSchema.parse({ id, enabled });

	await db
		.update(dessertsTable)
		.set({
			enabled: validated.enabled,
			isOutOfStock: validated.enabled ? false : undefined,
		})
		.where(eq(dessertsTable.id, validated.id));

	await runNextAppEffect(updateDessertTagsEffect());
}

export async function toggleOutOfStock(id: number, isOutOfStock: boolean) {
	await requireAuth();

	// Validate input
	const validated = toggleOutOfStockSchema.parse({ id, isOutOfStock });

	await db
		.update(dessertsTable)
		.set({ isOutOfStock: validated.isOutOfStock })
		.where(eq(dessertsTable.id, validated.id));

	await runNextAppEffect(updateDessertTagsEffect());
}

export const getCachedDesserts = unstable_cache(getDesserts, [CacheTag.desserts], {
	revalidate: 60 * 60 * 24,
	tags: [CacheTag.desserts],
});

export async function createDessert(data: Omit<Dessert, "id" | "sequence" | "isDeleted">) {
	await requireAuth();

	// Validate and sanitize input
	const validated = createDessertSchema.parse(data);
	const sanitizedDescription = validated.description ? sanitizeDescription(validated.description) : null;

	try {
		// Create dessert in database
		const [newDessert] = await db
			.insert(dessertsTable)
			.values({
				...validated,
				description: sanitizedDescription,
			})
			.returning({ id: dessertsTable.id });

		await initializeSequence(newDessert.id);

		await runNextAppEffect(updateDessertTagsEffect());
	} catch (error: unknown) {
		if (error instanceof Error && "code" in error && (error as { code: string }).code === "23505") {
			throw new Error("A dessert with this name already exists");
		}
		throw error;
	}
}

export async function updateDessert(id: number, data: Omit<Dessert, "id" | "enabled" | "sequence" | "isDeleted">) {
	await requireAuth();

	// Validate and sanitize input
	const validated = updateDessertSchema.parse({ id, data });
	const sanitizedDescription = validated.data.description ? sanitizeDescription(validated.data.description) : null;

	try {
		await db
			.update(dessertsTable)
			.set({
				name: validated.data.name,
				description: sanitizedDescription,
				price: validated.data.price,
				kind: validated.data.kind,
				isOutOfStock: validated.data.isOutOfStock,
				hasUnlimitedStock: validated.data.hasUnlimitedStock,
			})
			.where(eq(dessertsTable.id, validated.id));

		await runNextAppEffect(updateDessertTagsEffect());
	} catch (error: unknown) {
		if (error instanceof Error && "code" in error && (error as { code: string }).code === "23505") {
			throw new Error("A dessert with this name already exists");
		}
		throw error;
	}
}

export async function deleteDessert(id: number) {
	await requireAuth();

	// Validate input
	const { id: validatedId } = deleteDessertSchema.parse({ id });

	// Fetch current name first, then rename on delete to free up the unique constraint
	const [current] = await db
		.select({ name: dessertsTable.name })
		.from(dessertsTable)
		.where(eq(dessertsTable.id, validatedId));

	const suffix = `_deleted_${Date.now()}`;
	const baseName = current?.name ?? "deleted";
	const deletedName =
		baseName.length + suffix.length > 255
			? `${baseName.slice(0, 255 - suffix.length)}${suffix}`
			: `${baseName}${suffix}`;

	await db.update(dessertsTable).set({ isDeleted: true, name: deletedName }).where(eq(dessertsTable.id, validatedId));

	await runNextAppEffect(updateDessertTagsEffect());
}

export async function updateDessertSequence(id: number, newScore: number) {
	await requireAuth();

	// Validate input
	const validated = updateDessertSequenceSchema.parse({ id, newScore });

	await updateSequence(validated.id, validated.newScore);

	await runNextAppEffect(updateDessertTagsEffect());
}

export async function disableAllDesserts() {
	await requireAuth();

	await db.update(dessertsTable).set({ enabled: false }).where(eq(dessertsTable.isDeleted, false));

	await runNextAppEffect(updateDessertTagsEffect());
}

export async function moveDessertToTop(id: number) {
	await requireAuth();

	// PERFORMANCE: Use aggregate query instead of loading all desserts
	// Get min sequence with a single query
	const result = await db
		.select({
			minSequence: sql<number>`MIN(${dessertsTable.sequence})`,
		})
		.from(dessertsTable)
		.where(and(eq(dessertsTable.isDeleted, false), eq(dessertsTable.enabled, true)));

	const minSequence = result[0]?.minSequence ?? 0;
	const newSequence = minSequence - 1;

	await updateSequence(id, newSequence);

	await runNextAppEffect(updateDessertTagsEffect());
}

export async function moveDessertToBottom(id: number) {
	await requireAuth();

	// PERFORMANCE: Use aggregate query instead of loading all desserts
	// Get max sequence with a single query
	const result = await db
		.select({
			maxSequence: sql<number>`MAX(${dessertsTable.sequence})`,
		})
		.from(dessertsTable)
		.where(and(eq(dessertsTable.isDeleted, false), eq(dessertsTable.enabled, true)));

	const maxSequence = result[0]?.maxSequence ?? 0;
	const newSequence = maxSequence + 1;

	await updateSequence(id, newSequence);

	await runNextAppEffect(updateDessertTagsEffect());
}
