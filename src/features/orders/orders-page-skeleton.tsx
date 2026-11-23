import { DateSwitcherSkeleton } from "@/components/ui/date-switcher";
import { Skeleton } from "@/components/ui/skeleton";
import type { Area } from "@/features/access/area";
import { CocoaDaybookSkeleton } from "@/features/orders/cocoa-daybook-skeleton";
import { canBrowsePastDays } from "@/features/orders/contract";
import { ORDERS_SHOW_REVENUE } from "@/features/orders/presentation";

/** Mirrors the Orders page: header, date row and daybook. */
export function OrdersPageSkeleton({ area }: { area: Area }) {
	const showRevenue = ORDERS_SHOW_REVENUE[area];
	return (
		<div aria-hidden="true">
			<div className="flex flex-col gap-4 pb-4 md:pb-6">
				<div className="flex min-h-11 items-center gap-3">
					<div className="min-w-0 flex-1">
						<Skeleton className="my-0.5 h-6 w-24 md:h-7" />
					</div>
					<Skeleton className="size-11 shrink-0 rounded-lg md:h-9 md:w-26" />
				</div>
				{canBrowsePastDays(area) ? (
					<DateSwitcherSkeleton />
				) : (
					<div className="flex h-9 items-center">
						<Skeleton className="h-5 w-36" />
					</div>
				)}
			</div>
			<CocoaDaybookSkeleton showRevenue={showRevenue} />
		</div>
	);
}
