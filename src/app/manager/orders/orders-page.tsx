"use client";

import { DateDisplay } from "@/components/date-switcher";
import { CocoaDaybook } from "@/components/orders/cocoa-daybook";
import { OrderCancelAction } from "@/components/orders/order-cancel-action";
import { RefreshOrdersButton } from "@/components/orders/refresh-orders-button";
import { PageHeader } from "@/components/ui/page-header";
import type { SerializedOrders } from "@/lib/order-lifecycle";
import { useManagerOrdersController } from "./use-manager-orders-controller";

export default function OrdersPage({
	initialOrders,
	todayLabel,
}: {
	initialOrders: SerializedOrders;
	todayLabel: string;
}) {
	const { model, isBusy, refreshOrders, cancelOrder } = useManagerOrdersController(initialOrders, todayLabel);

	return (
		<div>
			<PageHeader title="Orders" action={<RefreshOrdersButton onRefresh={refreshOrders} busy={isBusy} />}>
				<DateDisplay label={model.todayLabel} />
			</PageHeader>

			<CocoaDaybook
				model={model}
				renderCancelAction={(order) => <OrderCancelAction order={order} onCancelOrder={cancelOrder} />}
			/>
		</div>
	);
}
