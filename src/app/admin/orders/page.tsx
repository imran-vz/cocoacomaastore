import type { Metadata } from "next";
import { OrdersRoute, type OrdersSearchParams } from "@/features/orders/orders-route";
import { pageMetadata } from "@/features/shell/routes";

export const metadata: Metadata = pageMetadata("/admin/orders");

export default function AdminOrders({ searchParams }: { searchParams: OrdersSearchParams }) {
	return <OrdersRoute area="admin" searchParams={searchParams} />;
}
