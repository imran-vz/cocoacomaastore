import type { Metadata } from "next";
import { OrdersRoute, type OrdersSearchParams } from "@/features/orders/orders-route";
import { pageMetadata } from "@/features/shell/routes";

export const metadata: Metadata = pageMetadata("/manager/orders");

export default function ManagerOrders({ searchParams }: { searchParams: OrdersSearchParams }) {
	return <OrdersRoute area="manager" searchParams={searchParams} />;
}
