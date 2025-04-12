import { Inventory } from "@/components/inventory";
import { db } from "@/db";
import { dessertsTable } from "@/db/schema";
import { Suspense } from "react";

export default async function Home() {
	const desserts = await db.select().from(dessertsTable);

	return (
		<main className="min-h-screen p-3 pb-6">
			<Suspense fallback={<div>Loading...</div>}>
				<Inventory desserts={desserts} />
			</Suspense>
		</main>
	);
}
