import type { Metadata } from "next";
import { Suspense } from "react";

import { getOrders } from "./actions";
import OrdersPage from "./orders-page";

export const dynamic = "force-dynamic"; // forces dynamic rendering

export const metadata: Metadata = {
	title: "Orders Management",
	description: "Orders Management",
};

export default async function Orders() {
	const orders = await getOrders();
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<OrdersPage initialOrders={orders} />
		</Suspense>
	);
}
