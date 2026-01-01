"use server";

import { performance } from "node:perf_hooks";
import { and, eq, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import {
	dailyDessertInventoryTable,
	dessertsTable,
	inventoryAuditLogTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { updateSequence } from "@/lib/sequence";

function getStartOfDay(date: Date = new Date()) {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

export async function toggleDessert(id: number, enabled: boolean) {
	const start = performance.now();
	await db
		.update(dessertsTable)
		.set({ enabled, isOutOfStock: enabled ? false : undefined })
		.where(eq(dessertsTable.id, id));
	const duration = performance.now() - start;
	console.log(`toggleDessert: ${duration.toFixed(2)}ms`);
	revalidateTag("desserts", "max");
}

export async function disableAllDesserts() {
	const start = performance.now();
	await db
		.update(dessertsTable)
		.set({ enabled: false })
		.where(eq(dessertsTable.isDeleted, false));
	const duration = performance.now() - start;
	console.log(`disableAllDesserts: ${duration.toFixed(2)}ms`);
	revalidateTag("desserts", "max");
}

export async function updateDessertSequence(id: number, newScore: number) {
	const start = performance.now();
	await updateSequence(id, newScore);
	const duration = performance.now() - start;
	console.log(`updateDessertSequence: ${duration.toFixed(2)}ms`);
	revalidateTag("desserts", "max");
}

export async function moveDessertToTop(id: number) {
	const start = performance.now();

	const enabledDesserts = await db.query.dessertsTable.findMany({
		where: and(
			eq(dessertsTable.isDeleted, false),
			eq(dessertsTable.enabled, true),
		),
		orderBy: (desserts, { asc }) => [asc(desserts.sequence)],
	});

	const dessertToMove = enabledDesserts.find((d) => d.id === id);
	if (!dessertToMove || enabledDesserts.length <= 1) return;

	const minSequence = Math.min(...enabledDesserts.map((d) => d.sequence));
	await updateSequence(id, minSequence - 1);

	const duration = performance.now() - start;
	console.log(`moveDessertToTop: ${duration.toFixed(2)}ms`);
	revalidateTag("desserts", "max");
}

export async function moveDessertToBottom(id: number) {
	const start = performance.now();

	const enabledDesserts = await db.query.dessertsTable.findMany({
		where: and(
			eq(dessertsTable.isDeleted, false),
			eq(dessertsTable.enabled, true),
		),
		orderBy: (desserts, { asc }) => [asc(desserts.sequence)],
	});

	const dessertToMove = enabledDesserts.find((d) => d.id === id);
	if (!dessertToMove || enabledDesserts.length <= 1) return;

	const maxSequence = Math.max(...enabledDesserts.map((d) => d.sequence));
	await updateSequence(id, maxSequence + 1);

	const duration = performance.now() - start;
	console.log(`moveDessertToBottom: ${duration.toFixed(2)}ms`);
	revalidateTag("desserts", "max");
}

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
