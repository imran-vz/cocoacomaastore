"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { revalidateTag, unstable_cache } from "next/cache";

import { db } from "@/db";
import { dessertsTable } from "@/db/schema";
import type { Dessert } from "@/lib/types";
import { performance } from "node:perf_hooks";

async function getDesserts({
	shouldShowDisabled = false,
}: { shouldShowDisabled?: boolean } = {}) {
	const start = performance.now();
	const desserts = await db.query.dessertsTable.findMany({
		where: and(
			eq(dessertsTable.isDeleted, false),
			shouldShowDisabled ? undefined : eq(dessertsTable.enabled, true),
		),
		orderBy: [asc(dessertsTable.sequence)],
	});
	const duration = performance.now() - start;
	console.log(`getDesserts: ${duration}ms`);
	return desserts;
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
	const [result] = await db
		.select({
			maxSequence: sql<number>`coalesce(max(${dessertsTable.sequence}), -1)`,
		})
		.from(dessertsTable);

	const nextSequence = (result?.maxSequence ?? -1) + 1;

	await db.insert(dessertsTable).values({ ...data, sequence: nextSequence });
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
	const duration = performance.now() - start;
	console.log(`deleteDessert: ${duration}ms`);
	revalidateTag("desserts");
}

export async function updateDessertSequence(id: number, newSequence: number) {
	const start = performance.now();
	await db.transaction(async (tx) => {
		// Get all non-deleted desserts ordered by sequence
		const desserts = await tx
			.select({
				id: dessertsTable.id,
				sequence: dessertsTable.sequence,
			})
			.from(dessertsTable)
			.where(eq(dessertsTable.isDeleted, false))
			.orderBy(asc(dessertsTable.sequence));

		// Find the dessert we're moving
		const movingDessert = desserts.find((d) => d.id === id);
		if (!movingDessert) return;

		// Update all sequences in one go
		await tx
			.update(dessertsTable)
			.set({
				sequence: sql`case 
					when id = ${id}::int then ${newSequence}::int
					when sequence between least(${newSequence}::int, ${movingDessert.sequence}::int) and greatest(${newSequence}::int, ${movingDessert.sequence}::int)
					then sequence + case 
						when ${newSequence}::int > ${movingDessert.sequence}::int then -1 
						else 1 
					end
					else sequence
				end`,
			})
			.where(eq(dessertsTable.isDeleted, false));
	});

	const duration = performance.now() - start;
	console.log(`updateDessertSequence: ${duration}ms`);
	revalidateTag("desserts");
}
