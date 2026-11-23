import type { Metadata } from "next";
import { Suspense } from "react";

import { OrdersPageSkeleton } from "@/components/orders/orders-page-skeleton";
import { PageFrame } from "@/components/page-frame";
import { formatDateShort } from "@/lib/format";
import { getOrders } from "./actions";
import OrdersPage from "./orders-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Orders",
	description: "View and manage today's orders",
};

export default async function Orders() {
	const orders = await getOrders();
	// Rendered once on the server in shop time and passed down, so the client never
	// re-computes it during hydration (the old client-only label caused a mismatch).
	// Same wording as the admin date stepper: "Today · 23 Nov".
	const todayLabel = `Today · ${formatDateShort(new Date())}`;

	return (
		<PageFrame frame="wide" centered as="main">
			<Suspense fallback={<OrdersPageSkeleton variant="manager" />}>
				<OrdersPage initialOrders={orders} todayLabel={todayLabel} />
			</Suspense>
		</PageFrame>
	);
}
