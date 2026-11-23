import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Transaction } from "@/db";
import { dailyDessertInventoryTable, inventoryAuditLogTable } from "@/db/schema";
import { UserFacingError } from "@/lib/errors";
import { analyticsDate, type DayKey } from "@/lib/shop-calendar";

const AUDIT_ACTION = {
	count: "set_stock",
	order: "order_deducted",
	cancellation: "order_cancelled",
} as const satisfies Record<string, (typeof inventoryAuditLogTable.$inferInsert)["action"]>;

type StockEntry = { dayKey: DayKey; userId: string; now: Date };

type OrderStockEntry = StockEntry & { orderId: number };

type StockWrite = { dessertId: number; previousQuantity: number; newQuantity: number; note?: string };

/**
 * Locks one shop day's stock rows for `dessertIds` and returns their quantities; desserts without a
 * row that day are absent. Every stock writer locks through here, in dessert-id order, so concurrent
 * multi-row writes queue behind each other instead of deadlocking.
 */
export async function lockDayStock(
	tx: Transaction,
	dayKey: DayKey,
	dessertIds: readonly number[],
): Promise<Map<number, number>> {
	const rows = await tx
		.select({ dessertId: dailyDessertInventoryTable.dessertId, quantity: dailyDessertInventoryTable.quantity })
		.from(dailyDessertInventoryTable)
		.where(
			and(
				eq(dailyDessertInventoryTable.day, analyticsDate(dayKey)),
				inArray(dailyDessertInventoryTable.dessertId, [...dessertIds]),
			),
		)
		.orderBy(asc(dailyDessertInventoryTable.dessertId))
		.for("update");
	return new Map(rows.map((row) => [row.dessertId, row.quantity]));
}

/** Sets rows already locked by `lockDayStock` to their new quantities and audits each write. */
async function writeDayStock(
	tx: Transaction,
	action: (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION],
	{ dayKey, userId, now, orderId }: StockEntry & { orderId?: number },
	writes: readonly StockWrite[],
) {
	if (writes.length === 0) return;
	const day = analyticsDate(dayKey);
	const sorted = [...writes].sort((left, right) => left.dessertId - right.dessertId);
	const quantityCases = sorted.map(({ dessertId, newQuantity }) => sql`WHEN ${dessertId} THEN ${newQuantity}::integer`);
	await tx
		.update(dailyDessertInventoryTable)
		.set({
			quantity: sql`CASE ${dailyDessertInventoryTable.dessertId} ${sql.join(quantityCases, sql` `)} ELSE ${dailyDessertInventoryTable.quantity} END`,
			updatedAt: now,
		})
		.where(
			and(
				eq(dailyDessertInventoryTable.day, day),
				inArray(
					dailyDessertInventoryTable.dessertId,
					sorted.map(({ dessertId }) => dessertId),
				),
			),
		);
	await tx.insert(inventoryAuditLogTable).values(
		sorted.map((write) => ({
			day,
			dessertId: write.dessertId,
			action,
			previousQuantity: write.previousQuantity,
			newQuantity: write.newQuantity,
			orderId,
			userId,
			note: write.note,
			createdAt: now,
		})),
	);
}

/** Records staff counts for rows already locked by `lockDayStock`. */
export function writeStockCounts(
	tx: Transaction,
	entry: StockEntry,
	counts: readonly { dessertId: number; previousQuantity: number; newQuantity: number }[],
) {
	return writeDayStock(
		tx,
		AUDIT_ACTION.count,
		entry,
		counts.map((count) => ({
			...count,
			note: `Stock set from ${count.previousQuantity} to ${count.newQuantity}`,
		})),
	);
}

/**
 * Takes an order's desserts out of the day's stock, failing with the first shortage. Lines of the
 * same dessert are taken together, so each dessert gets one deduction audit per order.
 */
export async function takeOrderStock(
	tx: Transaction,
	entry: OrderStockEntry,
	lines: readonly { dessertId: number; quantity: number; name: string }[],
) {
	const moves = [...Map.groupBy(lines, (line) => line.dessertId).values()].map((sameDessert) => ({
		...sameDessert[0],
		quantity: sameDessert.reduce((total, line) => total + line.quantity, 0),
	}));
	if (moves.length === 0) return;
	const stock = await lockDayStock(
		tx,
		entry.dayKey,
		moves.map(({ dessertId }) => dessertId),
	);
	const writes = moves.map((move): StockWrite => {
		const available = stock.get(move.dessertId) ?? 0;
		if (available < move.quantity) {
			throw new UserFacingError(
				`Insufficient stock for ${move.name}. Available: ${available}, Requested: ${move.quantity}`,
			);
		}
		return { dessertId: move.dessertId, previousQuantity: available, newQuantity: available - move.quantity };
	});
	await writeDayStock(tx, AUDIT_ACTION.order, entry, writes);
}

/**
 * Puts back exactly what the order's deduction audits record it took. `dessertIds` are the
 * desserts the order took stock of; the audits must cover each of them once and nothing else.
 */
export async function returnOrderStock(
	tx: Transaction,
	entry: OrderStockEntry & { note: string },
	dessertIds: readonly number[],
) {
	const audits = await tx
		.select({
			day: inventoryAuditLogTable.day,
			dessertId: inventoryAuditLogTable.dessertId,
			previousQuantity: inventoryAuditLogTable.previousQuantity,
			newQuantity: inventoryAuditLogTable.newQuantity,
		})
		.from(inventoryAuditLogTable)
		.where(
			and(eq(inventoryAuditLogTable.orderId, entry.orderId), eq(inventoryAuditLogTable.action, AUDIT_ACTION.order)),
		)
		.orderBy(asc(inventoryAuditLogTable.id));

	const unmatched = new Set(dessertIds);
	const day = analyticsDate(entry.dayKey).getTime();
	const moves = audits.map((audit) => {
		const quantity = audit.previousQuantity - audit.newQuantity;
		if (
			audit.dessertId === null ||
			audit.day.getTime() !== day ||
			audit.previousQuantity < 0 ||
			audit.newQuantity < 0 ||
			!Number.isSafeInteger(quantity) ||
			quantity <= 0
		) {
			throw new Error("Order inventory audit evidence is malformed");
		}
		if (!unmatched.delete(audit.dessertId)) throw new Error("Order inventory audit does not match its items");
		return { dessertId: audit.dessertId, quantity };
	});
	if (unmatched.size > 0) throw new Error("Order inventory audit does not match its items");
	if (moves.length === 0) return;

	const stock = await lockDayStock(
		tx,
		entry.dayKey,
		moves.map(({ dessertId }) => dessertId),
	);
	const writes = moves.map((move): StockWrite => {
		const current = stock.get(move.dessertId);
		if (current === undefined) throw new Error(`No stock row for dessert ${move.dessertId} on ${entry.dayKey}`);
		return {
			dessertId: move.dessertId,
			previousQuantity: current,
			newQuantity: current + move.quantity,
			note: entry.note,
		};
	});
	await writeDayStock(tx, AUDIT_ACTION.cancellation, entry, writes);
}
