import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { dessertsTable, orderItemsTable, ordersTable } from "./schema";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not set");
}

const client = postgres(process.env.DATABASE_URL, { prepare: false });

const db = drizzle(client, {
	schema: { dessertsTable, ordersTable, orderItemsTable },
});

async function main() {
	const desserts: (typeof dessertsTable.$inferInsert)[] = [
		{
			name: "Choco Fudge Brownie",
			price: 70,
			description:
				"A rich, decadent chocolate brownie with a fudge-like texture.",
		},
		{
			name: "Chocolate Chip Cookie",
			price: 50,
			description:
				"A soft, chewy chocolate chip cookie with a crispy exterior.",
		},
		{
			name: "Nutella Brownie",
			price: 85,
			description:
				"A rich, creamy Nutella brownie with a smooth and rich flavor.",
		},
	];

	await db.insert(dessertsTable).values(desserts);

	console.log("New Desserts created!");

	await client.end();
}

main();
