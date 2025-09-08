import { eq } from "drizzle-orm";

import { db } from "@/db";
import { dessertsTable } from "@/db/schema";

export async function updateSequence(id: number, score: number): Promise<void> {
	await db
		.update(dessertsTable)
		.set({ sequence: score })
		.where(eq(dessertsTable.id, id));
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
