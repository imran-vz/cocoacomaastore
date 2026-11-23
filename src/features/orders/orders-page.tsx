"use client";

import { parseAsInteger, useQueryState } from "nuqs";
import { use } from "react";
import { DateDisplay, DateSwitcher } from "@/components/ui/date-switcher";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import type { Area } from "@/features/access/area";
import { CocoaDaybook } from "@/features/orders/cocoa-daybook";
import { CocoaDaybookSkeleton } from "@/features/orders/cocoa-daybook-skeleton";
import { canBrowsePastDays, type DayOrders } from "@/features/orders/contract";
import { ORDER_ID_PARAM } from "@/features/orders/links";
import { OrderCancelAction } from "@/features/orders/order-cancel-action";
import { ORDERS_SHOW_REVENUE } from "@/features/orders/presentation";
import { RefreshOrdersButton } from "@/features/orders/refresh-orders-button";
import { useDayOrders } from "@/features/orders/use-day-orders";
import { usePageTitle } from "@/features/shell/use-page-chrome";
import type { ServerSnapshot } from "@/lib/server-snapshot";

export function OrdersPage({ area, initial }: { area: Area; initial: Promise<ServerSnapshot<DayOrders>> }) {
	const showRevenue = ORDERS_SHOW_REVENUE[area];
	const { day, setDay, today, screen, isRefreshing, refresh, cancel } = useDayOrders(area, use(initial));
	const [targetOrderId] = useQueryState(ORDER_ID_PARAM, parseAsInteger);
	const title = usePageTitle();
	return (
		<div>
			<PageHeader title={title} action={<RefreshOrdersButton onRefresh={refresh} busy={isRefreshing} />}>
				{canBrowsePastDays(area) ? (
					<DateSwitcher value={day} today={today} onChange={setDay} />
				) : (
					<DateDisplay today={today} />
				)}
			</PageHeader>

			{screen.status === "loading" ? (
				<CocoaDaybookSkeleton showRevenue={showRevenue} />
			) : screen.status === "failed" ? (
				<EmptyState
					variant="block"
					title="Couldn't load orders"
					description="Check the connection and try again."
					onRetry={refresh}
				/>
			) : (
				<>
					{screen.refreshFailed ? (
						<EmptyState
							role="alert"
							className="mb-4"
							description="Couldn't refresh these orders. They may be out of date."
							onRetry={refresh}
						/>
					) : null}
					<CocoaDaybook
						model={screen.orders}
						showRevenue={showRevenue}
						isToday={screen.isToday}
						targetOrderId={targetOrderId}
						renderCancelAction={
							screen.cancellable
								? (order, findToggle) => (
										<OrderCancelAction order={order} onCancelOrder={cancel} findToggle={findToggle} />
									)
								: undefined
						}
					/>
				</>
			)}
		</div>
	);
}
