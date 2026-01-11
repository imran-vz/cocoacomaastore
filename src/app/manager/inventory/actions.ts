"use server";

import { performance } from "node:perf_hooks";
import { eq, sql } from "drizzle-orm";
import { revalidateTag, unstable_cache } from "next/cache";

import { db } from "@/db";
import { dailyDessertInventoryTable } from "@/db/schema";
import { getServerSession } from "@/lib/auth";
import { upsertInventorySchema } from "@/lib/validation";

async function requireAuth() {
	const session = await getServerSession();
	if (!session?.session || !session?.user) {
		throw new Error("Unauthorized");
	}
	return session.user;
}

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
	await requireAuth();

	// Validate input
	const { updates: validatedUpdates } = upsertInventorySchema.parse({
		updates,
	});

	const start = performance.now();
	const day = getStartOfDay();
	const now = new Date();

	// PERFORMANCE: Bulk upsert in single query instead of loop
	// Prepare all values first
	const values = validatedUpdates.map((update) => ({
		day,
		dessertId: update.dessertId,
		quantity: Number.isFinite(update.quantity)
			? Math.max(0, Math.floor(update.quantity))
			: 0,
		updatedAt: now,
	}));

	// Single bulk insert/update query (much faster than N queries)
	if (values.length > 0) {
		await db
			.insert(dailyDessertInventoryTable)
			.values(values)
			.onConflictDoUpdate({
				target: [
					dailyDessertInventoryTable.day,
					dailyDessertInventoryTable.dessertId,
				],
				set: {
					quantity: sql`excluded.quantity`,
					updatedAt: sql`excluded.updated_at`,
				},
			});
	}

	const duration = performance.now() - start;
	console.log(`upsertTodayInventory: ${duration.toFixed(2)}ms`);
	revalidateTag("inventory", "max");
}
