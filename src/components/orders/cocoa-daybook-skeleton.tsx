import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DaybookTableColumns } from "./cocoa-daybook";

const rowSlots = ["one", "two", "three", "four", "five"];
const metricSlots = ["orders", "items", "revenue"];

/**
 * Mirrors `CocoaDaybook`: the summary strip, then three-line list rows (order · amount, first
 * item, time · items) below a 768px content width, or the table above it (`@3xl/main`).
 */
export function CocoaDaybookSkeleton({ metricCount = 2 }: { metricCount?: 2 | 3 }) {
	return (
		<div className="space-y-4" aria-hidden="true">
			<div
				className={cn(
					"grid gap-px overflow-hidden rounded-xl border bg-border",
					metricCount === 3 ? "grid-cols-3" : "grid-cols-2",
				)}
			>
				{metricSlots.slice(0, metricCount).map((slot) => (
					<div key={`daybook-stat-${slot}`} className="min-w-0 space-y-2 bg-card px-3 py-3 md:px-4">
						<Skeleton className="h-6 w-14 max-w-full" />
						<Skeleton className="h-3 w-16 max-w-full" />
					</div>
				))}
			</div>

			<div className="divide-y overflow-hidden rounded-xl border bg-card @3xl/main:hidden">
				{rowSlots.map((slot) => (
					<div key={`daybook-mobile-${slot}`} className="flex min-h-16 items-start gap-3 py-3 pr-3 pl-4">
						<div className="min-w-0 flex-1 space-y-2">
							<div className="flex items-center justify-between gap-3">
								<Skeleton className="h-4 w-16" />
								<Skeleton className="h-4 w-14" />
							</div>
							<Skeleton className="h-4 w-56 max-w-full" />
							<Skeleton className="h-3 w-28" />
						</div>
						<Skeleton className="mt-0.5 size-5 rounded" />
					</div>
				))}
			</div>

			<div className="hidden overflow-hidden rounded-xl border bg-card @3xl/main:block">
				<Table>
					<DaybookTableColumns />
					<TableBody>
						{rowSlots.map((slot) => (
							<TableRow key={`daybook-table-${slot}`}>
								<TableCell className="pl-4">
									<Skeleton className="h-4 w-12" />
								</TableCell>
								<TableCell>
									<Skeleton className="h-4 w-14" />
								</TableCell>
								<TableCell>
									<Skeleton className="h-4 w-48 max-w-full" />
								</TableCell>
								<TableCell>
									<Skeleton className="ml-auto h-4 w-6" />
								</TableCell>
								<TableCell>
									<Skeleton className="ml-auto h-4 w-14" />
								</TableCell>
								<TableCell className="pr-4">
									<Skeleton className="ml-auto size-8 rounded-lg" />
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
