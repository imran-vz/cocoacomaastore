import type { Metadata } from "next";
import { Suspense } from "react";
import { getCachedDesserts } from "@/app/desserts/actions";
import { PageFrame } from "@/components/page-frame";
import { Skeleton } from "@/components/ui/skeleton";
import { getCachedTodayInventory } from "./actions";
import InventoryPage from "./inventory-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Stock",
	description: "Today's stock count",
};

export default async function Inventory() {
	const desserts = getCachedDesserts();
	const inventory = getCachedTodayInventory();

	return (
		<PageFrame as="main" frame="narrow" centered>
			<Suspense
				fallback={
					<div className="flex w-full flex-col gap-3">
						<Skeleton className="h-7 w-24" />
						<Skeleton className="h-5 w-40" />
						<Skeleton className="mt-1 h-[178px] w-full rounded-xl" />
						<Skeleton className="mt-3 h-16 w-full rounded-xl" />
					</div>
				}
			>
				<InventoryPage initialDesserts={desserts} initialInventory={inventory} />
			</Suspense>
		</PageFrame>
	);
}
