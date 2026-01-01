"use server";

import { performance } from "node:perf_hooks";
import { eq } from "drizzle-orm";
import { revalidateTag, unstable_cache } from "next/cache";

import { db } from "@/db";
import { dailyDessertInventoryTable } from "@/db/schema";

export type TodayInventoryRow = {
	dessertId: number;
	quantity: number;
};

function getStartOfDay(date: Date = new Date()) {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

function getDayKey(day: Date) {
	const y = day.getFullYear();
	const m = String(day.getMonth() + 1).padStart(2, "0");
	const d = String(day.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

async function getInventoryForDay(day: Date): Promise<TodayInventoryRow[]> {
	const start = performance.now();
	const rows = await db
		.select({
			dessertId: dailyDessertInventoryTable.dessertId,
			quantity: dailyDessertInventoryTable.quantity,
		})
		.from(dailyDessertInventoryTable)
		.where(eq(dailyDessertInventoryTable.day, day));
	const duration = performance.now() - start;
	console.log(`getInventoryForDay: ${duration.toFixed(2)}ms`);
	return rows;
}

export async function getCachedTodayInventory() {
	const day = getStartOfDay();
	const dayKey = getDayKey(day);

	return unstable_cache(() => getInventoryForDay(day), ["inventory", dayKey], {
		revalidate: 60 * 60 * 24,
		tags: ["inventory"],
	})();
}

export async function upsertTodayInventory(
	updates: Array<{ dessertId: number; quantity: number }>,
) {
	const start = performance.now();
	const day = getStartOfDay();
	const now = new Date();

	await db.transaction(async (tx) => {
		for (const update of updates) {
			const quantity = Number.isFinite(update.quantity)
				? Math.max(0, Math.floor(update.quantity))
				: 0;

			await tx
				.insert(dailyDessertInventoryTable)
				.values({
					day,
					dessertId: update.dessertId,
					quantity,
					updatedAt: now,
				})
				.onConflictDoUpdate({
					target: [
						dailyDessertInventoryTable.day,
						dailyDessertInventoryTable.dessertId,
					],
					set: {
						quantity,
						updatedAt: now,
					},
				});
		}
	});

	const duration = performance.now() - start;
	console.log(`upsertTodayInventory: ${duration.toFixed(2)}ms`);
	revalidateTag("inventory", "max");
}
