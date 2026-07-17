"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SerializedOrders } from "@/lib/order-lifecycle";
import { cn } from "@/lib/utils";
import { CocoaDaybook } from "./designs/cocoa-daybook";
import { useManagerOrdersController } from "./use-manager-orders-controller";

export default function OrdersPage({ initialOrders }: { initialOrders: SerializedOrders }) {
	const { model, isBusy, refreshOrders, cancelOrder } = useManagerOrdersController(initialOrders);

	return (
		<div className="space-y-4">
			<header>
				<div className="flex items-start justify-between gap-3">
					<div>
						<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Orders</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							{model.todayLabel || <Skeleton className="h-4 w-40" />}
						</p>
					</div>
					<Button
						variant="outline"
						onClick={refreshOrders}
						disabled={isBusy}
						className={cn("h-11 md:h-8", isBusy && "animate-pulse motion-reduce:animate-none")}
					>
						<RefreshCw className={cn("size-4", isBusy && "animate-spin motion-reduce:animate-none")} />
						<span className="hidden sm:inline">{isBusy ? "Refreshing..." : "Refresh orders"}</span>
						<span className="sm:hidden">Refresh</span>
					</Button>
				</div>
			</header>

			<CocoaDaybook model={model} onCancelOrder={cancelOrder} />
		</div>
	);
}
