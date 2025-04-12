import { Inventory } from "@/components/inventory";
import { Suspense } from "react";
import { getDesserts } from "./admin/actions";

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
