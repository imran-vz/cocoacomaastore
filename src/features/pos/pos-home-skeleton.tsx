import { FieldSkeleton, Skeleton, skeletonSlots } from "@/components/ui/skeleton";
import {
	INLINE_CART_COLUMN_CLASS,
	POS_GRID_ROW_CLASS,
	POS_ROOT_CLASS,
	POS_SEARCH_ROW_CLASS,
	SHOWN_WITH_INLINE_CART,
	TILE_GRID_CLASS,
} from "@/features/pos/layout";
import { cn } from "@/lib/utils";

const tileSlots = skeletonSlots(12, "tile");

/**
 * The Sell screen while it loads, on the same geometry: the search bar, the tile grid and, where the
 * pane is wide enough, the empty inline cart. Phones get no cart; their cart bar appears once something is added.
 */
export function PosHomeSkeleton() {
	return (
		<div className={POS_ROOT_CLASS} aria-hidden="true">
			<div className="flex min-w-0 flex-1 flex-col">
				<div className={POS_SEARCH_ROW_CLASS}>
					<FieldSkeleton />
				</div>
				<div className={cn(POS_GRID_ROW_CLASS, "pb-6")}>
					<div className="@container/products">
						<div className={TILE_GRID_CLASS}>
							{tileSlots.map((slot) => (
								<div key={slot} className="surface-card flex min-h-27 flex-col p-3 shadow-xs">
									<Skeleton className="h-4 w-4/5" />
									<Skeleton className="mt-1.5 h-4 w-1/2" />
									<div className="mt-auto flex items-end justify-between gap-2 pt-2">
										<Skeleton className="h-4 w-12" />
										<Skeleton className="size-4 rounded" />
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
			<div className={cn(INLINE_CART_COLUMN_CLASS, SHOWN_WITH_INLINE_CART)}>
				<div className="surface-card flex h-full flex-col overflow-hidden shadow-xs">
					<div className="flex h-12 shrink-0 items-center border-b px-4">
						<Skeleton className="h-5 w-14" />
					</div>
					<div className="grid shrink-0 grid-cols-2 gap-2 border-b px-4 py-3">
						{skeletonSlots(2, "field").map((slot) => (
							<div key={slot} className="space-y-1">
								<Skeleton className="h-3 w-16" />
								<Skeleton className="h-9 w-full" />
							</div>
						))}
					</div>
					<div className="flex flex-1 flex-col items-center justify-center gap-2 px-4">
						<Skeleton className="size-10 rounded-[12px]" />
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-3 w-32" />
					</div>
					<div className="shrink-0 p-4">
						<Skeleton className="h-9 w-full" />
					</div>
				</div>
			</div>
		</div>
	);
}
