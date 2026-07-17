"use client";

import { IndianRupee } from "lucide-react";
import { use } from "react";
import { DateSwitcher } from "@/components/date-switcher";
import { CocoaDaybook } from "@/components/orders/cocoa-daybook";
import { CocoaDaybookSkeleton } from "@/components/orders/cocoa-daybook-skeleton";
import { OrderCancelAction } from "@/components/orders/order-cancel-action";
import type { SerializedOrders } from "@/lib/order-lifecycle";
import { useAdminOrdersController } from "./use-admin-orders-controller";

export default function AdminOrdersPage({ initialOrders }: { initialOrders: Promise<SerializedOrders> }) {
	const initialOrdersData = use(initialOrders);
	const { model, isLoading, selectedDate, handleDateChange, targetOrderId, canCancelOrders, cancelOrder } =
		useAdminOrdersController(initialOrdersData);

	return (
		<div className="space-y-4">
			<header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Orders</h1>
					<p className="mt-1 text-sm text-muted-foreground">View and manage orders</p>
				</div>
				<DateSwitcher selectedDate={selectedDate} onDateChange={handleDateChange} />
			</header>

			{isLoading ? (
				<CocoaDaybookSkeleton metricCount={3} />
			) : (
				<CocoaDaybook
					model={model}
					additionalMetric={{ label: "Net revenue", value: model.netRevenueLabel, icon: IndianRupee }}
					targetOrderId={targetOrderId}
					renderCancelAction={(order) =>
						canCancelOrders ? <OrderCancelAction order={order} onCancelOrder={cancelOrder} /> : null
					}
					emptyState={{ title: "No orders", description: "No orders found for the selected date" }}
				/>
			)}
		</div>
	);
}
