import { Suspense } from "react";
import { getOrders } from "../admin/actions";
import OrdersPage from "./orders-page";

export default async function Orders() {
	const orders = await getOrders();
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<OrdersPage initialOrders={orders} />
		</Suspense>
	);
}
