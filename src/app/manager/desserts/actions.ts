"use server";

import { performance } from "node:perf_hooks";
import { eq, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import {
	dailyDessertInventoryTable,
	inventoryAuditLogTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";

function getStartOfDay(date: Date = new Date()) {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

// Manager-specific action for inventory management
export async function upsertInventoryWithAudit(
	updates: Array<{ dessertId: number; quantity: number }>,
) {
	const start = performance.now();
	const day = getStartOfDay();
	const now = new Date();

	if (updates.length === 0) return;

	const session = await auth.api.getSession({
		headers: await headers(),
	});
	const userId = session?.user?.id ?? null;

	await db.transaction(async (tx) => {
		// Get current inventory for audit log
		const currentInventory = await tx
			.select({
				dessertId: dailyDessertInventoryTable.dessertId,
				quantity: dailyDessertInventoryTable.quantity,
			})
			.from(dailyDessertInventoryTable)
			.where(eq(dailyDessertInventoryTable.day, day));

		const currentMap = new Map(
			currentInventory.map((r) => [r.dessertId, r.quantity]),
		);

		// Prepare bulk data
		const auditLogEntries: Array<{
			day: Date;
			dessertId: number;
			action: "set_stock";
			previousQuantity: number;
			newQuantity: number;
			userId: string | null;
			note: string;
			createdAt: Date;
		}> = [];

		const inventoryValues: Array<{
			day: Date;
			dessertId: number;
			quantity: number;
			updatedAt: Date;
		}> = [];

		for (const update of updates) {
			const quantity = Number.isFinite(update.quantity)
				? Math.max(0, Math.floor(update.quantity))
				: 0;

			const previousQuantity = currentMap.get(update.dessertId) ?? 0;

			// Only log if quantity actually changed
			if (previousQuantity !== quantity) {
				auditLogEntries.push({
					day,
					dessertId: update.dessertId,
					action: "set_stock",
					previousQuantity,
					newQuantity: quantity,
					userId,
					note: `Stock set from ${previousQuantity} to ${quantity}`,
					createdAt: now,
				});
			}

			inventoryValues.push({
				day,
				dessertId: update.dessertId,
				quantity,
				updatedAt: now,
			});
		}

		// Bulk insert audit log entries (single query)
		if (auditLogEntries.length > 0) {
			await tx.insert(inventoryAuditLogTable).values(auditLogEntries);
		}

		// Bulk upsert inventory (single query with ON CONFLICT)
		if (inventoryValues.length > 0) {
			await tx
				.insert(dailyDessertInventoryTable)
				.values(inventoryValues)
				.onConflictDoUpdate({
					target: [
						dailyDessertInventoryTable.day,
						dailyDessertInventoryTable.dessertId,
					],
					set: {
						quantity: sql`excluded.quantity`,
						updatedAt: sql`excluded."updatedAt"`,
					},
				});
		}
	});

	const duration = performance.now() - start;
	console.log(`upsertInventoryWithAudit: ${duration.toFixed(2)}ms`);
	revalidateTag("inventory", "max");
}
