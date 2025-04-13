import type { Metadata } from "next";
import { Suspense } from "react";

import { getCachedOrders } from "./actions";
import OrdersPage from "./orders-page";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic"; // forces dynamic rendering

export const metadata: Metadata = {
	title: "Orders Management",
	description: "Orders Management",
};

export default async function Orders() {
	const orders = getCachedOrders();

	return (
		<main className="min-h-screen p-3 pb-6 max-w-md mx-auto">
			<Suspense
				fallback={
					<div className="flex flex-col gap-4 ">
						<h1 className="text-2xl font-bold mb-6">Orders</h1>
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
					</div>
				}
			>
				<OrdersPage initialOrders={orders} />
			</Suspense>
		</main>
	);
}
