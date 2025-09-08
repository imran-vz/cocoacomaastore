import { Skeleton } from "@/components/ui/skeleton";

export function DessertCardSkeleton() {
	return (
		<div className="bg-card border rounded-lg p-4 shadow-sm">
			{/* Header with name and price */}
			<div className="flex items-start justify-between mb-3">
				<div className="flex-1 min-w-0 mr-2">
					<Skeleton className="h-6 w-3/4 mb-2" />
					<Skeleton className="h-4 w-full" />
				</div>
				<div className="text-right flex-shrink-0">
					<Skeleton className="h-6 w-16" />
				</div>
			</div>

			{/* Status and position */}
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2">
					<Skeleton className="h-6 w-20 rounded-full" />
					<Skeleton className="h-4 w-16" />
				</div>
			</div>

			{/* Actions */}
			<div className="flex items-center justify-between">
				{/* Reorder buttons */}
				<div className="flex items-center gap-1">
					<Skeleton className="h-8 w-8 rounded" />
					<Skeleton className="h-8 w-8 rounded" />
				</div>

				{/* Edit and toggle buttons */}
				<div className="flex items-center gap-2">
					<Skeleton className="h-8 w-12 rounded" />
					<Skeleton className="h-8 w-16 rounded" />
				</div>
			</div>
		</div>
	);
}