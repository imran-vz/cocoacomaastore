import "server-only";

import { and, count, desc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import type { AppDatabase } from "@/db";
import { db } from "@/db";
import { dailyDessertInventoryTable, dessertsTable, inventoryAuditLogTable } from "@/db/schema";
import { requireStaff } from "@/features/access/session";
import { sellOrder } from "@/features/catalog/queries";
import type { StockUpdate } from "@/features/inventory/schemas";
import type { DayInventory, DessertStock, StockChanges } from "@/features/inventory/shapes";
import { lockDayStock, writeStockCounts } from "@/features/inventory/stock-ledger";
import { dayInventoryTags } from "@/features/inventory/tags";
import { CacheTag, TAGGED_READ_REVALIDATE_SECONDS } from "@/lib/cache-tags";
import { analyticsDate, type DayKey, dayKeyOf } from "@/lib/shop-calendar";

async function readDayInventory(dayKey: DayKey): Promise<DayInventory> {
	const rows = await db
		.select({ dessertId: dailyDessertInventoryTable.dessertId, quantity: dailyDessertInventoryTable.quantity })
		.from(dailyDessertInventoryTable)
		.where(eq(dailyDessertInventoryTable.day, analyticsDate(dayKey)));
	return { dayKey, rows };
}

export async function getTodayInventory(): Promise<DayInventory> {
	await requireStaff();
	const dayKey = dayKeyOf();
	return unstable_cache(() => readDayInventory(dayKey), [CacheTag.inventory, dayKey], {
		revalidate: TAGGED_READ_REVALIDATE_SECONDS,
		tags: dayInventoryTags(dayKey),
	})();
}

/** `conflict`: a count changed since the editor loaded it (an order or another device), so nothing was written. */
export type StockSaveResult = { status: "saved" } | { status: "conflict"; conflictedIds: number[] };

class StockConflictRollback extends Error {
	constructor(readonly conflictedIds: number[]) {
		super("Inventory changed while it was being edited");
	}
}

/**
 * Sets absolute counts for one shop day in a single transaction, auditing each change. Every row
 * must still hold its `expectedQuantity`, otherwise the whole batch is rolled back as a conflict.
 */
export async function setStockWithAudit(
	database: AppDatabase,
	{ dayKey, updates, userId }: { dayKey: DayKey; updates: readonly StockUpdate[]; userId: string },
): Promise<StockSaveResult> {
	const day = analyticsDate(dayKey);
	const sortedDessertIds = updates.map(({ dessertId }) => dessertId).sort((left, right) => left - right);

	try {
		return await database.transaction(async (tx) => {
			const now = new Date();
			await tx
				.insert(dailyDessertInventoryTable)
				.values(sortedDessertIds.map((dessertId) => ({ day, dessertId, quantity: 0, updatedAt: now })))
				.onConflictDoNothing({ target: [dailyDessertInventoryTable.day, dailyDessertInventoryTable.dessertId] });

			const stock = await lockDayStock(tx, dayKey, sortedDessertIds);
			const conflictedIds = updates.flatMap(({ dessertId, expectedQuantity }) => {
				const actualQuantity = stock.get(dessertId);
				if (actualQuantity === undefined) throw new Error("Failed to lock every requested inventory row");
				return actualQuantity !== expectedQuantity ? [dessertId] : [];
			});
			if (conflictedIds.length > 0) throw new StockConflictRollback(conflictedIds);

			await writeStockCounts(
				tx,
				{ dayKey, userId, now },
				updates
					.filter(({ expectedQuantity, quantity }) => quantity !== expectedQuantity)
					.map(({ dessertId, expectedQuantity, quantity }) => ({
						dessertId,
						previousQuantity: expectedQuantity,
						newQuantity: quantity,
					})),
			);
			return { status: "saved" } as const;
		});
	} catch (error) {
		if (error instanceof StockConflictRollback) return { status: "conflict", conflictedIds: error.conflictedIds };
		throw error;
	}
}

/** Every listed dessert with its count on `day`, in Sell order. Callers check access. */
export async function readDayStock(day: DayKey): Promise<DessertStock[]> {
	const rows = await db
		.select({
			id: dessertsTable.id,
			name: dessertsTable.name,
			hasUnlimitedStock: dessertsTable.hasUnlimitedStock,
			enabled: dessertsTable.enabled,
			currentStock: dailyDessertInventoryTable.quantity,
		})
		.from(dessertsTable)
		.leftJoin(
			dailyDessertInventoryTable,
			and(
				eq(dailyDessertInventoryTable.dessertId, dessertsTable.id),
				eq(dailyDessertInventoryTable.day, analyticsDate(day)),
			),
		)
		.where(eq(dessertsTable.isDeleted, false))
		.orderBy(...sellOrder);
	return rows.map((row) => ({ ...row, currentStock: row.currentStock ?? 0 }));
}

/**
 * The latest `limit` changes to `day`'s stock, newest first, and how many there are in all. Changes
 * whose dessert row was deleted (the log keeps them with no dessert) are left out of both. Callers
 * check access.
 */
export async function readStockChanges(day: DayKey, limit: number): Promise<StockChanges> {
	const ofDay = eq(inventoryAuditLogTable.day, analyticsDate(day));
	const ofListedDessert = eq(inventoryAuditLogTable.dessertId, dessertsTable.id);
	const [entries, [{ total }]] = await Promise.all([
		db
			.select({
				id: inventoryAuditLogTable.id,
				dessertName: dessertsTable.name,
				action: inventoryAuditLogTable.action,
				previousQuantity: inventoryAuditLogTable.previousQuantity,
				newQuantity: inventoryAuditLogTable.newQuantity,
				orderId: inventoryAuditLogTable.orderId,
				createdAt: inventoryAuditLogTable.createdAt,
				note: inventoryAuditLogTable.note,
			})
			.from(inventoryAuditLogTable)
			.innerJoin(dessertsTable, ofListedDessert)
			.where(ofDay)
			.orderBy(desc(inventoryAuditLogTable.createdAt), desc(inventoryAuditLogTable.id))
			.limit(limit),
		db.select({ total: count() }).from(inventoryAuditLogTable).innerJoin(dessertsTable, ofListedDessert).where(ofDay),
	]);
	return { entries: entries.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() })), total };
}
