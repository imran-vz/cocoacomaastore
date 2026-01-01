import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { getCachedOrders } from "./actions";
import OrdersPage from "./orders-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Orders",
	description: "View and manage today's orders",
};

function OrdersSkeleton() {
	return (
		<div className="space-y-4">
			{/* Header skeleton */}
			<div>
				<Skeleton className="h-8 w-24" />
				<Skeleton className="h-4 w-48 mt-1" />
			</div>

			{/* Stats skeleton */}
			<div className="grid grid-cols-3 gap-3">
				<Skeleton className="h-20 rounded-lg" />
				<Skeleton className="h-20 rounded-lg" />
				<Skeleton className="h-20 rounded-lg" />
			</div>

			{/* Orders skeleton */}
			<div className="space-y-3">
				<Skeleton className="h-24 rounded-lg" />
				<Skeleton className="h-24 rounded-lg" />
				<Skeleton className="h-24 rounded-lg" />
			</div>
		</div>
	);
}

export default async function Orders() {
	const orders = await getCachedOrders();

	return (
		<main className="min-h-[calc(100vh-52px)] p-4 pb-8 w-full max-w-2xl mx-auto">
			<Suspense fallback={<OrdersSkeleton />}>
				<OrdersPage initialOrders={orders} />
			</Suspense>
		</main>
	);
}
