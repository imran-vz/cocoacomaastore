import { performance } from "node:perf_hooks";
import { and, eq, sql } from "drizzle-orm";
import { Effect } from "effect";
import { db } from "@/db";
import { dailyDessertInventoryTable, inventoryAuditLogTable } from "@/db/schema";
import { getAnalyticsDay, getDayKey } from "@/lib/ist-date";
import { Database } from "@/server/effect/services/db";

export type TodayInventoryRow = {
	dessertId: number;
	quantity: number;
};

export type InventoryUpdate = {
	dessertId: number;
	quantity: number;
};

export function getDailyInventoryDay(date: Date = new Date()) {
	return getAnalyticsDay(date);
}

export function getDailyInventoryDayKey(date: Date = new Date()) {
	return getDayKey(date);
}

export function normalizeInventoryQuantity(quantity: number) {
	return Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
}

export async function getInventoryForDay(day: Date): Promise<TodayInventoryRow[]> {
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

export async function getBaseInventoryQuantity(baseDessertId: number, day = getDailyInventoryDay()) {
	const [inventory] = await db
		.select({ quantity: dailyDessertInventoryTable.quantity })
		.from(dailyDessertInventoryTable)
		.where(and(eq(dailyDessertInventoryTable.dessertId, baseDessertId), eq(dailyDessertInventoryTable.day, day)));

	return inventory?.quantity ?? 0;
}

export function upsertInventoryForDayEffect({
	day,
	updates,
	now = new Date(),
}: {
	day: Date;
	updates: readonly InventoryUpdate[];
	now?: Date;
}) {
	const values = updates.map((update) => ({
		day,
		dessertId: update.dessertId,
		quantity: normalizeInventoryQuantity(update.quantity),
		updatedAt: now,
	}));

	return Effect.gen(function* () {
		const database = yield* Database;

		if (values.length === 0) return;

		yield* database.attempt("upsert daily inventory", (db) =>
			db
				.insert(dailyDessertInventoryTable)
				.values(values)
				.onConflictDoUpdate({
					target: [dailyDessertInventoryTable.day, dailyDessertInventoryTable.dessertId],
					set: {
						quantity: sql`excluded.quantity`,
						updatedAt: sql`excluded."updatedAt"`,
					},
				}),
		);
	});
}

export function setInventoryWithAuditEffect({
	day,
	updates,
	userId,
	now = new Date(),
}: {
	day: Date;
	updates: readonly InventoryUpdate[];
	userId: string;
	now?: Date;
}) {
	return Effect.gen(function* () {
		const database = yield* Database;

		if (updates.length === 0) return;

		yield* database.attempt("set daily inventory with audit", (db) =>
			db.transaction(async (tx) => {
				const currentInventory = await tx
					.select({
						dessertId: dailyDessertInventoryTable.dessertId,
						quantity: dailyDessertInventoryTable.quantity,
					})
					.from(dailyDessertInventoryTable)
					.where(eq(dailyDessertInventoryTable.day, day));

				const currentMap = new Map(currentInventory.map((row) => [row.dessertId, row.quantity]));

				const auditLogEntries = updates
					.map((update) => {
						const quantity = normalizeInventoryQuantity(update.quantity);
						const previousQuantity = currentMap.get(update.dessertId) ?? 0;

						if (previousQuantity === quantity) return null;

						return {
							day,
							dessertId: update.dessertId,
							action: "set_stock" as const,
							previousQuantity,
							newQuantity: quantity,
							userId,
							note: `Stock set from ${previousQuantity} to ${quantity}`,
							createdAt: now,
						};
					})
					.filter((entry) => entry !== null);

				const inventoryValues = updates.map((update) => ({
					day,
					dessertId: update.dessertId,
					quantity: normalizeInventoryQuantity(update.quantity),
					updatedAt: now,
				}));

				if (auditLogEntries.length > 0) {
					await tx.insert(inventoryAuditLogTable).values(auditLogEntries);
				}

				if (inventoryValues.length > 0) {
					await tx
						.insert(dailyDessertInventoryTable)
						.values(inventoryValues)
						.onConflictDoUpdate({
							target: [dailyDessertInventoryTable.day, dailyDessertInventoryTable.dessertId],
							set: {
								quantity: sql`excluded.quantity`,
								updatedAt: sql`excluded."updatedAt"`,
							},
						});
				}
			}),
		);
	});
}
