"use server";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { dessertsTable } from "@/db/schema";
import type { Dessert } from "@/lib/types";

export async function getDesserts() {
	return await db.query.dessertsTable.findMany({
		where: eq(dessertsTable.isDeleted, false),
		orderBy: [asc(dessertsTable.id)],
	});
}

export async function createDessert(data: Omit<Dessert, "id">) {
	await db.insert(dessertsTable).values({
		name: data.name,
		description: data.description,
		price: data.price,
	});
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
}

export async function deleteDessert(id: number) {
	await db
		.update(dessertsTable)
		.set({ isDeleted: true })
		.where(eq(dessertsTable.id, id));
}
