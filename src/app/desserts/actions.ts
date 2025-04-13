"use server";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { dessertsTable } from "@/db/schema";
import type { Dessert } from "@/lib/types";
import { revalidateTag, unstable_cache } from "next/cache";

export async function getDesserts() {
	return unstable_cache(
		async () =>
			await db.query.dessertsTable.findMany({
				where: eq(dessertsTable.isDeleted, false),
				orderBy: [asc(dessertsTable.id)],
			}),
		["desserts"],
		{ revalidate: 60 * 60 * 24, tags: ["desserts"] },
	);
}

export async function createDessert(data: Omit<Dessert, "id">) {
	await db.insert(dessertsTable).values({
		name: data.name,
		description: data.description,
		price: data.price,
	});
	revalidateTag("desserts");
}

export async function updateDessert(id: number, data: Omit<Dessert, "id">) {
	await db
		.update(dessertsTable)
		.set({
			name: data.name,
			description: data.description,
			price: data.price,
		})
		.where(eq(dessertsTable.id, id));
	revalidateTag("desserts");
}

export async function deleteDessert(id: number) {
	await db
		.update(dessertsTable)
		.set({ isDeleted: true })
		.where(eq(dessertsTable.id, id));
	revalidateTag("desserts");
}
