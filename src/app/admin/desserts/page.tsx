import type { Metadata } from "next";
import { Suspense } from "react";

import { getCachedDesserts } from "@/app/desserts/actions";
import { getCachedTodayInventory } from "@/app/manager/inventory/actions";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { DessertsSkeleton } from "../loading-skeletons";
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
		<AdminPageShell>
			<Suspense fallback={<DessertsSkeleton includeMain={false} />}>
				<ManageDesserts initialDesserts={desserts} initialInventory={inventory} />
			</Suspense>
		</AdminPageShell>
	);
}
