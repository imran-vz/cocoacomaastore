import type { Metadata } from "next";
import { Suspense } from "react";

import { getCachedDesserts } from "@/app/_desserts/actions";
import { Skeleton } from "@/components/ui/skeleton";
import { getCachedTodayInventory } from "./actions";
import InventoryPage from "./inventory-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Inventory",
	description: "Daily inventory management",
};

export default async function Inventory() {
	const desserts = getCachedDesserts();
	const inventory = getCachedTodayInventory();

	return (
		<main className="min-h-[calc(100vh-52px)] p-3 pb-6 max-w-2xl mx-auto">
			<Suspense
				fallback={
					<div className="flex flex-col gap-4">
						<h1 className="text-2xl font-bold">Inventory</h1>
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
					</div>
				}
			>
				<InventoryPage
					initialDesserts={desserts}
					initialInventory={inventory}
				/>
			</Suspense>
		</main>
	);
}
