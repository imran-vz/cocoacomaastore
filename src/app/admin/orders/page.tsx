import type { Metadata } from "next";
import { Suspense } from "react";
import { getCachedOrders } from "@/app/manager/orders/actions";
import { OrdersSkeleton } from "../loading-skeletons";
import OrdersPage from "./orders-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Orders - Admin",
	description: "View and manage all orders",
};

export default async function AdminOrders() {
	const orders = await getCachedOrders();

	return (
		<main className="min-h-[calc(100vh-52px)] p-4 pb-8 w-full max-w-4xl mx-auto">
			<Suspense fallback={<OrdersSkeleton includeMain={false} />}>
				<OrdersPage initialOrders={orders} />
			</Suspense>
		</main>
	);
}
