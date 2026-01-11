"use server";

import { performance } from "node:perf_hooks";
import { and, eq, sql } from "drizzle-orm";
import { revalidateTag, unstable_cache } from "next/cache";

import { db } from "@/db";
import { dessertsTable } from "@/db/schema";
import { getServerSession } from "@/lib/auth";
import { sanitizeDescription } from "@/lib/sanitize";
import {
	batchUpdateDessertSequencesSchema,
	createDessertSchema,
	deleteDessertSchema,
	toggleDessertSchema,
	toggleOutOfStockSchema,
	updateDessertSchema,
	updateDessertSequenceSchema,
} from "@/lib/validation";

async function requireAuth() {
	const session = await getServerSession();
	if (!session?.session || !session?.user) {
		throw new Error("Unauthorized");
	}
	return session.user;
}

import {
	bulkUpdateSequences,
	initializeSequence,
	updateSequence,
} from "@/lib/sequence";
import type { Dessert } from "@/lib/types";

async function getDesserts({
	shouldShowDisabled = false,
}: {
	shouldShowDisabled?: boolean;
} = {}) {
	const start = performance.now();

	// Get desserts from database, sorted by sequence
	const desserts = await db.query.dessertsTable.findMany({
		where: and(
			eq(dessertsTable.isDeleted, false),
			shouldShowDisabled ? undefined : eq(dessertsTable.enabled, true),
		),
		orderBy: (desserts, { asc }) => [asc(desserts.sequence)],
	});

	const duration = performance.now() - start;
	console.log(`getDesserts: ${duration.toFixed(2)}ms`);
	return desserts;
}

export async function toggleDessert(id: number, enabled: boolean) {
	await requireAuth();

	// Validate input
	const validated = toggleDessertSchema.parse({ id, enabled });

	const start = performance.now();
	await db
		.update(dessertsTable)
		.set({
			enabled: validated.enabled,
			isOutOfStock: validated.enabled ? false : undefined,
		})
		.where(eq(dessertsTable.id, validated.id));
	const duration = performance.now() - start;
	console.log(`toggleDessert: ${duration.toFixed(2)}ms`);
	revalidateTag("desserts", "max");
}

export async function toggleOutOfStock(id: number, isOutOfStock: boolean) {
	await requireAuth();

	// Validate input
	const validated = toggleOutOfStockSchema.parse({ id, isOutOfStock });

	const start = performance.now();
	await db
		.update(dessertsTable)
		.set({ isOutOfStock: validated.isOutOfStock })
		.where(eq(dessertsTable.id, validated.id));
	const duration = performance.now() - start;
	console.log(`toggleOutOfStock: ${duration.toFixed(2)}ms`);
	revalidateTag("desserts", "max");
}

export const getCachedDesserts = unstable_cache(getDesserts, ["desserts"], {
	revalidate: 60 * 60 * 24,
	tags: ["desserts"],
});

export async function createDessert(
	data: Omit<Dessert, "id" | "sequence" | "isDeleted">,
) {
	await requireAuth();

	// Validate and sanitize input
	const validated = createDessertSchema.parse(data);
	const sanitizedDescription = validated.description
		? sanitizeDescription(validated.description)
		: null;

	const start = performance.now();

	// Create dessert in database
	const [newDessert] = await db
		.insert(dessertsTable)
		.values({
			...validated,
			description: sanitizedDescription,
		})
		.returning({ id: dessertsTable.id });

	// Initialize sequence in Redis
	await initializeSequence(newDessert.id);

	const duration = performance.now() - start;
	console.log(`createDessert: ${duration.toFixed(2)}ms`);
	revalidateTag("desserts", "max");
}

export async function updateDessert(
	id: number,
	data: Omit<Dessert, "id" | "enabled" | "sequence" | "isDeleted">,
) {
	await requireAuth();

	// Validate and sanitize input
	const validated = updateDessertSchema.parse({ id, data });
	const sanitizedDescription = validated.data.description
		? sanitizeDescription(validated.data.description)
		: null;

	const start = performance.now();
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
	const duration = performance.now() - start;
	console.log(`updateDessert: ${duration.toFixed(2)}ms`);
	revalidateTag("desserts", "max");
}

export async function deleteDessert(id: number) {
	await requireAuth();

	// Validate input
	const { id: validatedId } = deleteDessertSchema.parse({ id });

	const start = performance.now();

	await db
		.update(dessertsTable)
		.set({ isDeleted: true })
		.where(eq(dessertsTable.id, validatedId));

	const duration = performance.now() - start;
	console.log(`deleteDessert: ${duration.toFixed(2)}ms`);
	revalidateTag("desserts", "max");
}

export async function updateDessertSequence(id: number, newScore: number) {
	await requireAuth();

	// Validate input
	const validated = updateDessertSequenceSchema.parse({ id, newScore });

	const start = performance.now();

	// Update sequence in Redis
	await updateSequence(validated.id, validated.newScore);

	const duration = performance.now() - start;
	console.log(`updateDessertSequence: ${duration.toFixed(2)}ms`);
	revalidateTag("desserts", "max");
}

export async function batchUpdateDessertSequences(
	updates: Array<{ id: number; newScore: number }>,
) {
	await requireAuth();

	// Validate input
	const { updates: validatedUpdates } = batchUpdateDessertSequencesSchema.parse(
		{ updates },
	);

	const start = performance.now();

	// Use bulk update with a single SQL query instead of multiple queries
	await bulkUpdateSequences(
		validatedUpdates.map(({ id, newScore }) => ({ id, sequence: newScore })),
	);

	const duration = performance.now() - start;
	console.log(
		`batchUpdateDessertSequences: ${updates.length} updates in ${duration.toFixed(2)}ms`,
	);

	// Only revalidate once at the end
	revalidateTag("desserts", "max");
}

export async function disableAllDesserts() {
	await requireAuth();
	const start = performance.now();
	await db
		.update(dessertsTable)
		.set({ enabled: false })
		.where(eq(dessertsTable.isDeleted, false));
	const duration = performance.now() - start;
	console.log(`disableAllDesserts: ${duration.toFixed(2)}ms`);
	revalidateTag("desserts", "max");
}

export async function moveDessertToTop(id: number) {
	await requireAuth();
	const start = performance.now();

	// PERFORMANCE: Use aggregate query instead of loading all desserts
	// Get min sequence with a single query
	const result = await db
		.select({
			minSequence: sql<number>`MIN(${dessertsTable.sequence})`,
		})
		.from(dessertsTable)
		.where(
			and(eq(dessertsTable.isDeleted, false), eq(dessertsTable.enabled, true)),
		);

	const minSequence = result[0]?.minSequence ?? 0;
	const newSequence = minSequence - 1;

	await updateSequence(id, newSequence);

	const duration = performance.now() - start;
	console.log(`moveDessertToTop: ${duration.toFixed(2)}ms`);
	revalidateTag("desserts", "max");
}

export async function moveDessertToBottom(id: number) {
	await requireAuth();
	const start = performance.now();

	// PERFORMANCE: Use aggregate query instead of loading all desserts
	// Get max sequence with a single query
	const result = await db
		.select({
			maxSequence: sql<number>`MAX(${dessertsTable.sequence})`,
		})
		.from(dessertsTable)
		.where(
			and(eq(dessertsTable.isDeleted, false), eq(dessertsTable.enabled, true)),
		);

	const maxSequence = result[0]?.maxSequence ?? 0;
	const newSequence = maxSequence + 1;

	await updateSequence(id, newSequence);

	const duration = performance.now() - start;
	console.log(`moveDessertToBottom: ${duration.toFixed(2)}ms`);
	revalidateTag("desserts", "max");
}
