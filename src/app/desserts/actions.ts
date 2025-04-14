"use server";

import { asc, eq } from "drizzle-orm";
import { revalidateTag, unstable_cache } from "next/cache";

import { db } from "@/db";
import { dessertsTable } from "@/db/schema";
import type { Dessert } from "@/lib/types";
import { performance } from "node:perf_hooks";

async function getDesserts() {
	const start = performance.now();
	const desserts = await db.query.dessertsTable.findMany({
		where: eq(dessertsTable.isDeleted, false),
		orderBy: [asc(dessertsTable.id)],
	});
	const duration = performance.now() - start;
	console.log(`getDesserts: ${duration}ms`);
	return desserts;
}

export const getCachedDesserts = unstable_cache(getDesserts, ["desserts"], {
	revalidate: 60 * 60 * 24,
	tags: ["desserts"],
});

export async function createDessert(data: Omit<Dessert, "id">) {
	const start = performance.now();
	await db.insert(dessertsTable).values({
		name: data.name,
		description: data.description,
		price: data.price,
	});
	const duration = performance.now() - start;
	console.log(`createDessert: ${duration}ms`);
	revalidateTag("desserts");
}

export async function updateDessert(id: number, data: Omit<Dessert, "id">) {
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
	const duration = performance.now() - start;
	console.log(`deleteDessert: ${duration}ms`);
	revalidateTag("desserts");
}
