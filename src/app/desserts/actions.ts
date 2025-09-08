"use server";

import { performance } from "node:perf_hooks";
import { and, eq } from "drizzle-orm";
import { revalidateTag, unstable_cache } from "next/cache";

import { db } from "@/db";
import { dessertsTable } from "@/db/schema";
import { initializeSequence, updateSequence } from "@/lib/sequence";
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
	const start = performance.now();
	await db
		.update(dessertsTable)
		.set({ enabled })
		.where(eq(dessertsTable.id, id));
	const duration = performance.now() - start;
	console.log(`toggleDessert: ${duration.toFixed(2)}ms`);
	revalidateTag("desserts");
}

export const getCachedDesserts = unstable_cache(getDesserts, ["desserts"], {
	revalidate: 60 * 60 * 24,
	tags: ["desserts"],
});

export async function createDessert(data: Omit<Dessert, "id" | "sequence">) {
	const start = performance.now();

	// Create dessert in database
	const [newDessert] = await db
		.insert(dessertsTable)
		.values(data)
		.returning({ id: dessertsTable.id });

	// Initialize sequence in Redis
	await initializeSequence(newDessert.id);

	const duration = performance.now() - start;
	console.log(`createDessert: ${duration.toFixed(2)}ms`);
	revalidateTag("desserts");
}

export async function updateDessert(
	id: number,
	data: Omit<Dessert, "id" | "enabled" | "sequence">,
) {
	const start = performance.now();
	await db
		.update(dessertsTable)
		.set({
			name: data.name,
			description: data.description,
			price: data.price,
		})
		.where(eq(dessertsTable.id, id));
	const duration = performance.now() - start;
	console.log(`updateDessert: ${duration.toFixed(2)}ms`);
	revalidateTag("desserts");
}

export async function deleteDessert(id: number) {
	const start = performance.now();

	await db
		.update(dessertsTable)
		.set({ isDeleted: true })
		.where(eq(dessertsTable.id, id));

	const duration = performance.now() - start;
	console.log(`deleteDessert: ${duration.toFixed(2)}ms`);
	revalidateTag("desserts");
}

export async function updateDessertSequence(id: number, newScore: number) {
	const start = performance.now();

	// Update sequence in Redis
	await updateSequence(id, newScore);

	const duration = performance.now() - start;
	console.log(`updateDessertSequence: ${duration.toFixed(2)}ms`);
	revalidateTag("desserts");
}

export async function disableAllDesserts() {
	const start = performance.now();
	await db
		.update(dessertsTable)
		.set({ enabled: false })
		.where(eq(dessertsTable.isDeleted, false));
	const duration = performance.now() - start;
	console.log(`disableAllDesserts: ${duration.toFixed(2)}ms`);
	revalidateTag("desserts");
}
