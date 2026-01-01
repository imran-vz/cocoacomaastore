import { eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { dessertsTable } from "@/db/schema";

export async function updateSequence(id: number, score: number): Promise<void> {
	await db
		.update(dessertsTable)
		.set({ sequence: score })
		.where(eq(dessertsTable.id, id));
}

export async function bulkUpdateSequences(
	updates: Array<{ id: number; sequence: number }>,
): Promise<void> {
	if (updates.length === 0) return;

	// For a single update, use the simple approach
	if (updates.length === 1) {
		await updateSequence(updates[0].id, updates[0].sequence);
		return;
	}

	// Build a CASE WHEN statement for bulk update in a single query
	// UPDATE desserts SET sequence = CASE
	//   WHEN id = 1 THEN 10
	//   WHEN id = 2 THEN 20
	//   ...
	// END
	// WHERE id IN (1, 2, ...)
	const ids = updates.map((u) => u.id);

	const caseStatements = updates
		.map((u) => sql`WHEN ${dessertsTable.id} = ${u.id} THEN ${u.sequence}`)
		.reduce((acc, curr) => sql`${acc} ${curr}`);

	await db
		.update(dessertsTable)
		.set({
			sequence: sql`CASE ${caseStatements} END`,
		})
		.where(inArray(dessertsTable.id, ids));
}

export async function initializeSequence(id: number): Promise<void> {
	// Get the current maximum sequence value
	const maxSequenceDessert = await db.query.dessertsTable.findFirst({
		where: eq(dessertsTable.isDeleted, false),
		columns: { sequence: true },
		orderBy: (desserts, { desc }) => [desc(desserts.sequence)],
	});

	const nextScore = maxSequenceDessert ? maxSequenceDessert.sequence + 1 : 0;
	await updateSequence(id, nextScore);
}
