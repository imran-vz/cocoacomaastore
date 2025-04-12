import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-http";
import { dessertsTable } from "./schema";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not set");
}

const db = drizzle(process.env.DATABASE_URL);

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
}

main();
