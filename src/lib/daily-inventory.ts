import { performance } from "node:perf_hooks";
import { and, asc, eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { db } from "@/db";
import { dailyDessertInventoryTable, inventoryAuditLogTable } from "@/db/schema";
import { getAnalyticsDay, getDayKey } from "@/lib/ist-date";
import type { BackendDatabaseError } from "@/server/effect/errors";
import { Database } from "@/server/effect/services/db";

export type TodayInventoryRow = {
	dessertId: number;
	quantity: number;
};

export type InventoryUpdate = {
	dessertId: number;
	expectedQuantity: number;
	quantity: number;
};

export type InventoryWriteResult =
	| { ok: true; updatedCount: number }
	| {
			ok: false;
			code: "INVENTORY_CONFLICT";
			conflicts: Array<{
				dessertId: number;
				expectedQuantity: number;
				actualQuantity: number;
			}>;
	  };

type InventoryConflict = Extract<InventoryWriteResult, { ok: false }>["conflicts"][number];

class InventoryConflictRollback extends Error {
	constructor(readonly conflicts: InventoryConflict[]) {
		super("Inventory changed while it was being edited");
	}
}

export function getDailyInventoryDay(date: Date = new Date()) {
	return getAnalyticsDay(date);
}

export function getDailyInventoryDayKey(date: Date = new Date()) {
	return getDayKey(date);
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
}): Effect.Effect<InventoryWriteResult, BackendDatabaseError, Database> {
	if (updates.length === 0) return Effect.succeed({ ok: true, updatedCount: 0 });

	const sortedDessertIds = [...new Set(updates.map(({ dessertId }) => dessertId))].sort((left, right) => left - right);

	return Effect.gen(function* () {
		const database = yield* Database;
		return yield* database
			.attempt("set daily inventory with audit", (db) =>
				db.transaction(async (tx): Promise<InventoryWriteResult> => {
					await tx
						.insert(dailyDessertInventoryTable)
						.values(
							sortedDessertIds.map((dessertId) => ({
								day,
								dessertId,
								quantity: 0,
								updatedAt: now,
							})),
						)
						.onConflictDoNothing({
							target: [dailyDessertInventoryTable.day, dailyDessertInventoryTable.dessertId],
						});

					const currentInventory = await tx
						.select({
							dessertId: dailyDessertInventoryTable.dessertId,
							quantity: dailyDessertInventoryTable.quantity,
						})
						.from(dailyDessertInventoryTable)
						.where(
							and(
								eq(dailyDessertInventoryTable.day, day),
								inArray(dailyDessertInventoryTable.dessertId, sortedDessertIds),
							),
						)
						.orderBy(asc(dailyDessertInventoryTable.dessertId))
						.for("update");

					if (
						currentInventory.length !== sortedDessertIds.length ||
						currentInventory.some(({ dessertId }, index) => dessertId !== sortedDessertIds[index])
					) {
						throw new Error("Failed to lock every requested inventory row");
					}

					const currentMap = new Map(currentInventory.map((row) => [row.dessertId, row.quantity]));
					const conflicts = updates.flatMap<InventoryConflict>((update) => {
						const actualQuantity = currentMap.get(update.dessertId);
						if (actualQuantity === undefined) throw new Error("A locked inventory row was not found");
						return actualQuantity !== update.expectedQuantity
							? [
									{
										dessertId: update.dessertId,
										expectedQuantity: update.expectedQuantity,
										actualQuantity,
									},
								]
							: [];
					});
					if (conflicts.length > 0) throw new InventoryConflictRollback(conflicts);

					const changedUpdates = updates.filter(({ expectedQuantity, quantity }) => quantity !== expectedQuantity);
					if (changedUpdates.length === 0) return { ok: true, updatedCount: 0 };

					await tx.insert(inventoryAuditLogTable).values(
						changedUpdates.map((update) => ({
							day,
							dessertId: update.dessertId,
							action: "set_stock" as const,
							previousQuantity: update.expectedQuantity,
							newQuantity: update.quantity,
							userId,
							note: `Stock set from ${update.expectedQuantity} to ${update.quantity}`,
							createdAt: now,
						})),
					);

					for (const update of changedUpdates) {
						const updated = await tx
							.update(dailyDessertInventoryTable)
							.set({ quantity: update.quantity, updatedAt: now })
							.where(
								and(
									eq(dailyDessertInventoryTable.day, day),
									eq(dailyDessertInventoryTable.dessertId, update.dessertId),
								),
							)
							.returning({ dessertId: dailyDessertInventoryTable.dessertId });
						if (updated.length !== 1) throw new Error("Failed to update a locked inventory row");
					}

					return { ok: true, updatedCount: changedUpdates.length };
				}),
			)
			.pipe(
				Effect.catchAll((error) =>
					error.cause instanceof InventoryConflictRollback
						? Effect.succeed({ ok: false, code: "INVENTORY_CONFLICT", conflicts: error.cause.conflicts } as const)
						: Effect.fail(error),
				),
			);
	});
}
