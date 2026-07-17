import type { Metadata } from "next";
import { Suspense } from "react";

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

			<div className="mx-auto max-w-6xl space-y-3">
				<div className="grid grid-cols-2 gap-4 border-y py-3">
					<Skeleton className="h-10" />
					<Skeleton className="h-10" />
				</div>

				<div className="space-y-2">
					<Skeleton className="h-20 rounded-xl" />
					<Skeleton className="h-20 rounded-xl" />
					<Skeleton className="h-20 rounded-xl" />
					<Skeleton className="h-20 rounded-xl" />
				</div>
			</div>
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
