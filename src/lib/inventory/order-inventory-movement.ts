import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { db as drizzleDb } from "@/db";
import { dailyDessertInventoryTable, inventoryAuditLogTable } from "@/db/schema";

type InventoryTransaction = Parameters<Parameters<(typeof drizzleDb)["transaction"]>[0]>[0];

export type OrderInventoryMovement = {
	dessertId: number;
	quantity: number;
	name: string;
};

type OrderInventoryMovementDirection = "deduct" | "restore";

type OrderInventoryAudit = {
	action: "order_deducted" | "order_cancelled";
	orderId: number;
	userId: string;
	note?: string;
};

function mapMovementsByDessertId(movements: readonly OrderInventoryMovement[]) {
	return {
		ids: movements.map((item) => item.dessertId).sort((a, b) => a - b),
		quantityByDessertId: new Map(movements.map((item) => [item.dessertId, item.quantity])),
		nameByDessertId: new Map(movements.map((item) => [item.dessertId, item.name])),
	};
}

function buildInventoryUpdateCaseStatements({
	dessertIds,
	quantityByDessertId,
	direction,
}: {
	dessertIds: readonly number[];
	quantityByDessertId: ReadonlyMap<number, number>;
	direction: OrderInventoryMovementDirection;
}) {
	return dessertIds
		.map((dessertId) => {
			const quantity = quantityByDessertId.get(dessertId) ?? 0;
			const nextQuantity =
				direction === "deduct"
					? sql`${dailyDessertInventoryTable.quantity} - ${quantity}`
					: sql`${dailyDessertInventoryTable.quantity} + ${quantity}`;
			return sql`WHEN ${dailyDessertInventoryTable.dessertId} = ${dessertId} THEN ${nextQuantity}`;
		})
		.reduce((acc, curr) => sql`${acc} ${curr}`);
}

export async function applyOrderInventoryMovement({
	tx,
	day,
	now,
	movements,
	direction,
	audit,
}: {
	tx: InventoryTransaction;
	day: Date;
	now: Date;
	movements: readonly OrderInventoryMovement[];
	direction: OrderInventoryMovementDirection;
	audit: OrderInventoryAudit;
}) {
	if (movements.length === 0) return;

	const { ids: dessertIds, quantityByDessertId, nameByDessertId } = mapMovementsByDessertId(movements);
	const lockedInventory = await tx
		.select({
			dessertId: dailyDessertInventoryTable.dessertId,
			quantity: dailyDessertInventoryTable.quantity,
		})
		.from(dailyDessertInventoryTable)
		.where(and(eq(dailyDessertInventoryTable.day, day), inArray(dailyDessertInventoryTable.dessertId, dessertIds)))
		.orderBy(asc(dailyDessertInventoryTable.dessertId))
		.for("update");

	const stockMap = new Map(lockedInventory.map((row) => [row.dessertId, row.quantity]));

	if (direction === "deduct") {
		for (const dessertId of dessertIds) {
			const currentStock = stockMap.get(dessertId) ?? 0;
			const requestedQty = quantityByDessertId.get(dessertId) ?? 0;
			if (currentStock < requestedQty) {
				const name = nameByDessertId.get(dessertId) ?? "Unknown";
				throw new Error(`Insufficient stock for ${name}. Available: ${currentStock}, Requested: ${requestedQty}`);
			}
		}
	}

	const updated = await tx
		.update(dailyDessertInventoryTable)
		.set({
			quantity: sql`CASE ${buildInventoryUpdateCaseStatements({ dessertIds, quantityByDessertId, direction })} ELSE ${dailyDessertInventoryTable.quantity} END`,
			updatedAt: now,
		})
		.where(and(eq(dailyDessertInventoryTable.day, day), inArray(dailyDessertInventoryTable.dessertId, dessertIds)))
		.returning({
			dessertId: dailyDessertInventoryTable.dessertId,
			newQuantity: dailyDessertInventoryTable.quantity,
		});

	const updatedIds = new Set(updated.map((row) => row.dessertId));
	for (const dessertId of dessertIds) {
		if (!updatedIds.has(dessertId)) {
			const name = nameByDessertId.get(dessertId) ?? "Unknown";
			throw new Error(`Failed to update inventory for ${name} (unexpected error)`);
		}
	}

	await tx.insert(inventoryAuditLogTable).values(
		updated.map((row) => {
			const quantity = quantityByDessertId.get(row.dessertId) ?? 0;
			return {
				day,
				dessertId: row.dessertId,
				action: audit.action,
				previousQuantity: direction === "deduct" ? row.newQuantity + quantity : row.newQuantity - quantity,
				newQuantity: row.newQuantity,
				orderId: audit.orderId,
				userId: audit.userId,
				note: audit.note,
				createdAt: now,
			};
		}),
	);
}
