"use client";

import { use } from "react";
import { DateSwitcher } from "@/components/date-switcher";
import { CocoaDaybook } from "@/components/orders/cocoa-daybook";
import { CocoaDaybookSkeleton } from "@/components/orders/cocoa-daybook-skeleton";
import { OrderCancelAction } from "@/components/orders/order-cancel-action";
import { RefreshOrdersButton } from "@/components/orders/refresh-orders-button";
import { PageHeader } from "@/components/ui/page-header";
import type { SerializedOrders } from "@/lib/order-lifecycle";
import { useAdminOrdersController } from "./use-admin-orders-controller";

export default function AdminOrdersPage({ initialOrders }: { initialOrders: Promise<SerializedOrders> }) {
	const initialOrdersData = use(initialOrders);
	const {
		model,
		isLoading,
		isRefreshing,
		refreshOrders,
		selectedDate,
		handleDateChange,
		targetOrderId,
		canCancelOrders,
		cancelOrder,
	} = useAdminOrdersController(initialOrdersData);

	return (
		<div>
			<PageHeader title="Orders" action={<RefreshOrdersButton onRefresh={refreshOrders} busy={isRefreshing} />}>
				<DateSwitcher selectedDate={selectedDate} onDateChange={handleDateChange} />
			</PageHeader>

			{isLoading ? (
				<CocoaDaybookSkeleton metricCount={3} />
			) : (
				<CocoaDaybook
					model={model}
					additionalMetric={{ label: "Revenue", value: model.netRevenueLabel }}
					targetOrderId={targetOrderId}
					renderCancelAction={(order) =>
						canCancelOrders ? <OrderCancelAction order={order} onCancelOrder={cancelOrder} /> : null
					}
					emptyState={{ title: "No orders", description: "No orders were placed on this day." }}
				/>
			)}
		</div>
	);
}
