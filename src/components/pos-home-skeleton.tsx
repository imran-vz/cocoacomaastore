import { Skeleton } from "@/components/ui/skeleton";

const tileSlots = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

/**
 * Mirrors `POSHome` for both roles: the 44px search bar, the tile grid (≥ 150px tiles,
 * gap 8) and, only when the POS pane is wide enough (same rule as `usePosCartLayout`:
 * 340px catalog + 16px gap + 300px cart inside the 24px gutters ≈ 704px), the inline cart
 * card (its empty state is the `EmptyState` block: brand logo, title, one line). Phones
 * never get a cart column; their cart bar only appears once something is added.
 */
export function PosHomeSkeleton() {
	return (
		<div className="@container/pos-skeleton min-h-app" aria-hidden="true">
			<div className="flex md:gap-4 md:px-6">
				<div className="@container/pos-skeleton-grid min-w-0 flex-1">
					<div className="px-4 pt-3 pb-2 md:px-0 md:pt-6 md:pb-3">
						<Skeleton className="h-11 w-full rounded-xl md:h-9" />
					</div>
					<div className="px-4 pt-1 pb-6 md:px-0">
						<div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 @md/pos-skeleton-grid:gap-3 @3xl/pos-skeleton-grid:grid-cols-[repeat(auto-fill,minmax(176px,1fr))]">
							{tileSlots.map((slot) => (
								<div key={slot} className="flex min-h-27 flex-col rounded-xl border bg-card p-3 shadow-xs">
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
				<div className="sticky top-[calc(var(--app-bar-height)+1.5rem)] mt-6 mb-6 hidden h-[calc(100svh-var(--app-bar-height)-3rem)] w-75 shrink-0 self-start @min-[704px]/pos-skeleton:block @4xl/pos-skeleton:w-85 @6xl/pos-skeleton:w-95">
					<div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-xs">
						<div className="flex h-12 shrink-0 items-center border-b px-4">
							<Skeleton className="h-5 w-14" />
						</div>
						<div className="grid shrink-0 grid-cols-2 gap-2 border-b px-4 py-3">
							{["customer", "delivery"].map((slot) => (
								<div key={slot} className="space-y-1.5">
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
		</div>
	);
}
