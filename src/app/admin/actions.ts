"use server";

import { db } from "@/db";
import { dessertsTable } from "@/db/schema";
import type { Dessert } from "@/lib/types";
import { eq } from "drizzle-orm";

export async function getProducts() {
	return await db.select().from(dessertsTable).orderBy(dessertsTable.id);
}

export async function createProduct(data: Omit<Dessert, "id">) {
	return await db.insert(dessertsTable).values({
		name: data.name,
		description: data.description,
		price: data.price,
	});
}

export async function updateProduct(id: number, data: Omit<Dessert, "id">) {
	await db
		.update(dessertsTable)
		.set({
			name: data.name,
			description: data.description,
			price: data.price,
		})
		.where(eq(dessertsTable.id, id));
}

export async function deleteProduct(id: number) {
	await db.delete(dessertsTable).where(eq(dessertsTable.id, id));
}
