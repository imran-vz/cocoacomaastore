import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DaybookTableColumns } from "./cocoa-daybook";

const rowSlots = ["one", "two", "three", "four"];
const metricSlots = ["orders", "items", "revenue"];

export function CocoaDaybookSkeleton({ metricCount = 2 }: { metricCount?: 2 | 3 }) {
	return (
		<div className="mx-auto max-w-6xl space-y-3">
			<div className={cn("grid gap-4 border-y py-3", metricCount === 3 ? "grid-cols-3" : "grid-cols-2")}>
				{metricSlots.slice(0, metricCount).map((slot) => (
					<div key={`daybook-stat-${slot}`} className="min-w-0 space-y-2">
						<Skeleton className="h-3 w-20 max-w-full" />
						<Skeleton className="h-6 w-14" />
					</div>
				))}
			</div>

			<div className="overflow-hidden rounded-xl border bg-card md:hidden">
				<div className="divide-y">
					{rowSlots.map((slot) => (
						<div key={`daybook-mobile-${slot}`} className="space-y-2.5 px-3 py-3">
							<div className="flex items-center gap-2">
								<Skeleton className="h-4 w-14" />
								<Skeleton className="h-5 w-12 rounded-full" />
								<Skeleton className="h-3 w-12" />
								<Skeleton className="ml-auto h-4 w-16" />
							</div>
							<div className="flex items-center justify-between gap-2">
								<Skeleton className="h-4 w-40 max-w-full" />
								<Skeleton className="h-5 w-20 rounded-full" />
							</div>
						</div>
					))}
				</div>
			</div>

			<div className="hidden overflow-hidden rounded-xl border bg-card shadow-xs md:block">
				<Table>
					<DaybookTableColumns />
					<TableBody>
						{rowSlots.map((slot) => (
							<TableRow key={`daybook-table-${slot}`}>
								<TableCell>
									<Skeleton className="h-4 w-16" />
								</TableCell>
								<TableCell>
									<Skeleton className="h-5 w-12 rounded-full" />
								</TableCell>
								<TableCell>
									<Skeleton className="h-4 w-48 max-w-full" />
								</TableCell>
								<TableCell>
									<Skeleton className="ml-auto h-4 w-8" />
								</TableCell>
								<TableCell>
									<Skeleton className="ml-auto h-4 w-16" />
								</TableCell>
								<TableCell>
									<div className="flex items-center justify-end gap-2">
										<Skeleton className="h-5 w-20 rounded-full" />
										<Skeleton className="size-8 rounded-lg" />
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
