import type { Metadata } from "next";
import { Suspense } from "react";

import { CocoaDaybookSkeleton } from "@/components/orders/cocoa-daybook-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { getOrders } from "./actions";
import OrdersPage from "./orders-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Orders",
	description: "View and manage today's orders",
};

function OrdersSkeleton() {
	return (
		<div className="space-y-4">
			<div>
				<div className="flex items-start justify-between gap-3">
					<div>
						<Skeleton className="h-8 w-28" />
						<Skeleton className="mt-2 h-4 w-44" />
					</div>
					<Skeleton className="h-11 w-24 md:h-8 md:w-36" />
				</div>
			</div>

			<CocoaDaybookSkeleton />
		</div>
	);
}

export default async function Orders() {
	const orders = await getOrders();

	return (
		<main className="min-h-app mx-auto w-full max-w-7xl p-3 pb-6 md:p-4 md:pb-8">
			<Suspense fallback={<OrdersSkeleton />}>
				<OrdersPage initialOrders={orders} />
			</Suspense>
		</main>
	);
}
