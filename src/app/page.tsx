import { Suspense } from "react";

import { Inventory } from "@/components/inventory";
import { getDesserts } from "./desserts/actions";

export const dynamic = "force-dynamic"; // forces dynamic rendering

export default async function Home() {
	const desserts = await getDesserts();

	return (
		<main className="min-h-screen p-3 pb-6">
			<Suspense fallback={<div>Loading...</div>}>
				<Inventory desserts={desserts} />
			</Suspense>
		</main>
	);
}
