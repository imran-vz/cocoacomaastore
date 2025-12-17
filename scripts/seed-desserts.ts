import "dotenv/config";

import { db } from "../src/db";
import { dessertsTable } from "../src/db/schema";

async function seedDesserts() {
	console.log("Seeding desserts...");

	const desserts = [
		{
			name: "Choco Fudge Brownie",
			price: 70,
			description: "Rich chocolate fudge brownie",
			sequence: 1,
		},
		{
			name: "Nutella Fudge Brownie",
			price: 85,
			description: "Decadent Nutella fudge brownie",
			sequence: 2,
		},
		{
			name: "Double Trouble Brownie",
			price: 90,
			description: "Double chocolate brownie",
			sequence: 3,
		},
		{
			name: "Cookie Fudge Brownie",
			price: 95,
			description: "Brownie with cookie fudge",
			sequence: 4,
		},
		{
			name: "Ragi Fudge Brownie",
			price: 85,
			description: "Healthy ragi fudge brownie",
			sequence: 5,
		},
		{
			name: "Plum Cake Brownie",
			price: 110,
			description: "Festive plum cake brownie",
			sequence: 6,
		},
		{
			name: "Vanilla Blondie",
			price: 80,
			description: "Classic vanilla blondie",
			sequence: 7,
		},
		{
			name: "Nutella Blondie",
			price: 95,
			description: "Nutella-infused blondie",
			sequence: 8,
		},
		{
			name: "Eggless Choco Fudge Brownie",
			price: 80,
			description: "Eggless chocolate fudge brownie",
			sequence: 9,
		},
		{
			name: "Eggless Nutella Fudge Brownie",
			price: 95,
			description: "Eggless Nutella fudge brownie",
			sequence: 10,
		},
		{
			name: "Double Choco Muffin",
			price: 95,
			description: "Double chocolate muffin",
			sequence: 11,
		},
		{
			name: "Nutella Centre Filled Cookie",
			price: 75,
			description: "Cookie with Nutella center",
			sequence: 12,
		},
		{
			name: "Chunky Choco Cookie",
			price: 75,
			description: "Chunky chocolate cookie",
			sequence: 13,
		},
		{
			name: "Rich Chocolate Cupcake",
			price: 90,
			description: "Rich chocolate cupcake",
			sequence: 14,
		},
		{
			name: "Sugarless Classic Cheesecake",
			price: 150,
			description: "Sugarless classic cheesecake",
			sequence: 15,
		},
		{
			name: "Butter Biscuits",
			price: 110,
			description: "Buttery biscuits",
			sequence: 16,
		},
		{
			name: "Hot Chocolate",
			price: 30,
			description: "Hot chocolate drink",
			sequence: 17,
		},
		{
			name: "Hot Chocolate Takeway",
			price: 80,
			description: "Hot chocolate takeaway",
			sequence: 18,
		},
	];

	try {
		await db.insert(dessertsTable).values(desserts);

		console.log(`✅ Successfully seeded ${desserts.length} desserts!`);
	} catch (error) {
		console.error("❌ Error seeding desserts:", error);
		process.exit(1);
	}

	process.exit(0);
}

await seedDesserts();
