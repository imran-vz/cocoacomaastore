import type { Metadata } from "next";
import { Suspense } from "react";
import { getCachedDesserts } from "@/app/desserts/actions";
import { getCachedTodayInventory } from "@/app/manager/inventory/actions";
import ManageDessertsInventory from "@/components/manage-desserts-inventory";
import { PageFrame } from "@/components/page-frame";
import { Skeleton } from "@/components/ui/skeleton";
import { upsertInventoryWithAudit } from "@/lib/role-actions/manager-inventory";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Desserts",
	description: "Desserts, visibility and today's stock",
};

function CatalogFallback() {
	return (
		<div className="flex w-full flex-col gap-3">
			<Skeleton className="h-7 w-32" />
			<Skeleton className="h-5 w-44" />
			<Skeleton className="mt-1 h-11 w-full md:h-9 @2xl/main:max-w-xs" />
			<Skeleton className="mt-3 h-11 w-full md:h-9" />
			<Skeleton className="h-11 w-full md:h-9" />
			<Skeleton className="h-[392px] w-full rounded-xl" />
		</div>
	);
}

export default async function DessertsPage() {
	const desserts = getCachedDesserts({
		shouldShowDisabled: true,
	});
	const inventory = getCachedTodayInventory();

	return (
		<PageFrame as="main" frame="narrow" centered>
			<Suspense fallback={<CatalogFallback />}>
				<ManageDessertsInventory
					initialDesserts={desserts}
					initialInventory={inventory}
					onSaveInventory={upsertInventoryWithAudit}
					area="manager"
				/>
			</Suspense>
		</PageFrame>
	);
}
