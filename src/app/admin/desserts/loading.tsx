import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function DessertsLoading() {
	return (
		<main className="min-h-[calc(100vh-52px)] p-3 pb-6 max-w-7xl mx-auto">
			<div className="space-y-4 md:space-y-6 lg:space-y-8 p-2 sm:p-4 md:p-0">
				<div className="flex flex-col space-y-3 sm:space-y-4 md:flex-row md:justify-between md:items-center md:space-y-0">
					<h2 className="text-xl sm:text-2xl lg:text-3xl font-bold">
						Desserts
					</h2>
					<div className="flex flex-col space-y-2 sm:flex-row sm:gap-2 sm:space-y-0 md:gap-3">
						<Button
							type="button"
							variant="outline"
							className="w-full sm:w-auto text-sm"
							size="sm"
						>
							Disable All
						</Button>
						<Button
							type="button"
							className="w-full sm:w-auto text-sm"
							size="sm"
						>
							Add Dessert
						</Button>
					</div>
				</div>

				<div className="flex flex-col space-y-2 sm:flex-row sm:gap-3 sm:items-center sm:space-y-0 md:gap-4">
					<Skeleton className="h-10 w-full sm:flex-1 md:max-w-sm" />
				</div>

				{/* Available Desserts Section */}
				<div>
					<h3 className="text-lg font-semibold mb-4 text-green-700">
						Available Desserts
					</h3>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
						{Array.from({ length: 8 }).map((_, i) => (
							<div
								key={`dessert-loading-${
									// biome-ignore lint/suspicious/noArrayIndexKey: loading skeleton
									i
								}`}
								className="bg-card border rounded-lg p-4 shadow-sm"
							>
								{/* Header with name and price */}
								<div className="flex items-start justify-between mb-3">
									<div className="flex-1 min-w-0 mr-2">
										<Skeleton className="h-6 w-3/4 mb-2" />
										<Skeleton className="h-4 w-full" />
									</div>
									<div className="text-right shrink-0">
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
						))}
					</div>
				</div>
			</div>
		</main>
	);
}
