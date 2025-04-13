"use server";

import { asc, eq } from "drizzle-orm";
import { revalidateTag, unstable_cache } from "next/cache";

import { db } from "@/db";
import { dessertsTable } from "@/db/schema";
import type { Dessert } from "@/lib/types";

async function getDesserts() {
	console.time("getDesserts");
	const desserts = await db.query.dessertsTable.findMany({
		where: eq(dessertsTable.isDeleted, false),
		orderBy: [asc(dessertsTable.id)],
	});
	console.timeEnd("getDesserts");
	return desserts;
}

export const getCachedDesserts = unstable_cache(getDesserts, ["desserts"], {
	revalidate: 60 * 60 * 24,
	tags: ["desserts"],
});

export async function createDessert(data: Omit<Dessert, "id">) {
	console.time("createDessert");
	await db.insert(dessertsTable).values({
		name: data.name,
		description: data.description,
		price: data.price,
	});
	console.timeEnd("createDessert");
	revalidateTag("desserts");
}

export async function updateDessert(id: number, data: Omit<Dessert, "id">) {
	console.time("updateDessert");
	await db
		.update(dessertsTable)
		.set({
			name: data.name,
			description: data.description,
			price: data.price,
		})
		.where(eq(dessertsTable.id, id));
	console.timeEnd("updateDessert");
	revalidateTag("desserts");
}

export async function deleteDessert(id: number) {
	console.time("deleteDessert");
	await db
		.update(dessertsTable)
		.set({ isDeleted: true })
		.where(eq(dessertsTable.id, id));
	console.timeEnd("deleteDessert");
	revalidateTag("desserts");
}
