import type { Metadata } from "next";
import { Suspense } from "react";

import { getCachedDesserts } from "@/app/_desserts/actions";
import { getCachedTodayInventory } from "@/app/(manager)/inventory/actions";
import { Skeleton } from "@/components/ui/skeleton";
import ManageDessertsInventory from "./manage-desserts-inventory";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Desserts & Inventory",
	description: "Manage desserts and daily inventory",
};

export default async function DessertsPage() {
	const desserts = getCachedDesserts({
		shouldShowDisabled: true,
	});
	const inventory = getCachedTodayInventory();

	return (
		<main className="min-h-[calc(100vh-52px)] p-3 pb-6 max-w-4xl mx-auto">
			<Suspense
				fallback={
					<div className="flex flex-col gap-4">
						<h1 className="text-2xl font-bold">Desserts & Inventory</h1>
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
					</div>
				}
			>
				<ManageDessertsInventory
					initialDesserts={desserts}
					initialInventory={inventory}
				/>
			</Suspense>
		</main>
	);
}
