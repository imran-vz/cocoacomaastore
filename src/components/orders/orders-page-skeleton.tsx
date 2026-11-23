import { CocoaDaybookSkeleton } from "@/components/orders/cocoa-daybook-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the Orders page header for both roles: the title and the refresh button (44px
 * icon on phones, labelled from md), then the date row — the admin stepper (44 · fill · 44,
 * a 176px label from md) or the manager's read-only date label (`DateDisplay`, 36px) — then
 * the daybook.
 */
export function OrdersPageSkeleton({ variant }: { variant: "admin" | "manager" }) {
	const isAdmin = variant === "admin";
	return (
		<div aria-hidden="true">
			<div className="flex flex-col gap-4 pb-4 md:pb-6">
				<div className="flex min-h-11 items-center gap-3">
					<div className="min-w-0 flex-1">
						<Skeleton className="my-0.5 h-6 w-24 md:h-7" />
					</div>
					<Skeleton className="size-11 shrink-0 rounded-lg md:h-9 md:w-26" />
				</div>
				{isAdmin ? (
					<div className="flex w-full items-center gap-2 md:w-auto">
						<Skeleton className="size-11 shrink-0 rounded-lg md:size-9" />
						<Skeleton className="h-11 min-w-0 flex-1 rounded-lg md:h-9 md:w-44 md:flex-none" />
						<Skeleton className="size-11 shrink-0 rounded-lg md:size-9" />
					</div>
				) : (
					<div className="flex h-9 items-center">
						<Skeleton className="h-5 w-36" />
					</div>
				)}
			</div>
			<CocoaDaybookSkeleton metricCount={isAdmin ? 3 : 2} />
		</div>
	);
}
