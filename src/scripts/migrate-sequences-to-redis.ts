import { db } from "@/db";
import { dessertsTable } from "@/db/schema";
import { initializeSequence } from "@/lib/sequence";
import { eq } from "drizzle-orm";
import { asc } from "drizzle-orm";

async function migrateSequences() {
	const desserts = await db.query.dessertsTable.findMany({
		where: eq(dessertsTable.isDeleted, false),
		orderBy: [asc(dessertsTable.id)],
	});

	for (const [_, dessert] of desserts.entries()) {
		await initializeSequence(dessert.id);
	}

	console.log(`Migrated ${desserts.length} dessert sequences to Redis`);
}

migrateSequences().catch(console.error);
