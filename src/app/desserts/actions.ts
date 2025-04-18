"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidateTag, unstable_cache } from "next/cache";

import { db } from "@/db";
import { dessertsTable } from "@/db/schema";
import type { Dessert } from "@/lib/types";
import { performance } from "node:perf_hooks";
import {
	getAllSequences,
	initializeSequence,
	removeSequence,
	updateSequence,
} from "@/lib/sequence";

async function getDesserts({
	shouldShowDisabled = false,
}: { shouldShowDisabled?: boolean } = {}) {
	const start = performance.now();

	// Get desserts from database
	const desserts = await db.query.dessertsTable.findMany({
		where: and(
			eq(dessertsTable.isDeleted, false),
			shouldShowDisabled ? undefined : eq(dessertsTable.enabled, true),
		),
	});

	// Get sequences from Redis
	const sequences = await getAllSequences();
	console.log(" :32 | sequences:", sequences);

	// Sort desserts by sequence
	const sortedDesserts = desserts
		.toSorted((a, b) => {
			return (sequences[a.id] ?? 0) - (sequences[b.id] ?? 0);
		})
		.map((dessert) => ({
			...dessert,
			sequence: sequences[dessert.id] ?? 0,
		}));

	const duration = performance.now() - start;
	console.log(`getDesserts: ${duration}ms`);
	return sortedDesserts;
}

export async function toggleDessert(id: number, enabled: boolean) {
	const start = performance.now();
	await db
		.update(dessertsTable)
		.set({ enabled })
		.where(eq(dessertsTable.id, id));
	const duration = performance.now() - start;
	console.log(`toggleDessert: ${duration}ms`);
	revalidateTag("desserts");
}

export const getCachedDesserts = unstable_cache(getDesserts, ["desserts"], {
	revalidate: 60 * 60 * 24,
	tags: ["desserts"],
});

export async function createDessert(data: Omit<Dessert, "id">) {
	const start = performance.now();

	// Create dessert in database
	const [newDessert] = await db
		.insert(dessertsTable)
		.values(data)
		.returning({ id: dessertsTable.id });

	// Initialize sequence in Redis
	await initializeSequence(newDessert.id);

	const duration = performance.now() - start;
	console.log(`createDessert: ${duration}ms`);
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
	console.log(`updateDessert: ${duration}ms`);
	revalidateTag("desserts");
}

export async function deleteDessert(id: number) {
	const start = performance.now();

	await db
		.update(dessertsTable)
		.set({ isDeleted: true })
		.where(eq(dessertsTable.id, id));

	// Remove sequence from Redis
	await removeSequence(id);

	const duration = performance.now() - start;
	console.log(`deleteDessert: ${duration}ms`);
	revalidateTag("desserts");
}

export async function updateDessertSequence(id: number, newScore: number) {
	const start = performance.now();

	// Update sequence in Redis
	await updateSequence(id, newScore);

	const duration = performance.now() - start;
	console.log(`updateDessertSequence: ${duration}ms`);
	revalidateTag("desserts");
}
