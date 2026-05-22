import type { Metadata } from "next";

import { getCachedDesserts } from "@/app/desserts/actions";
import { getCachedTodayInventory } from "@/app/manager/inventory/actions";
import ManageDesserts from "./manage-desserts";

export const dynamic = "force-dynamic"; // forces dynamic rendering

export const metadata: Metadata = {
	title: "Desserts & Inventory",
	description: "Manage desserts and daily inventory",
};

export default async function page() {
	const desserts = getCachedDesserts({
		shouldShowDisabled: true,
	});
	const inventory = getCachedTodayInventory();

	return (
		<main className="min-h-[calc(100vh-52px)] p-3 pb-6">
			<ManageDesserts initialDesserts={desserts} initialInventory={inventory} />
		</main>
	);
}
