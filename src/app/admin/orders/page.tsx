import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { OrdersSkeleton } from "../loading-skeletons";
import { getCachedOrders } from "./actions";
import OrdersPage from "./orders-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Orders - Admin",
	description: "View and manage all orders",
};

export default async function AdminOrders() {
	const orders = getCachedOrders();

	return (
		<AdminPageShell>
			<Suspense fallback={<OrdersSkeleton includeMain={false} />}>
				<OrdersPage initialOrders={orders} />
			</Suspense>
		</AdminPageShell>
	);
}
