import type * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * The flat KPI grid (DESIGN.md §Type, "KPI value"): one opaque card, cells divided by hairlines
 * (the `bg-border` showing through `gap-px`), no card per KPI. Callers set the columns.
 */
export const statGridClass = "grid gap-px overflow-hidden rounded-xl border bg-border";

export function StatGrid({ className, ...props }: React.ComponentProps<"dl">) {
	return <dl data-slot="stat-grid" className={cn(statGridClass, className)} {...props} />;
}

/**
 * One KPI cell: the value (tabular, bold) over a muted sentence-case label and one optional
 * supporting line. Callers size the value for their grid with `valueClassName`.
 *
 * Values never truncate: a cell that is too narrow for its figure is a layout bug, fixed by
 * giving the figure more room (see `KpiSummary`), never by an ellipsis.
 */
export function Stat({
	label,
	value,
	detail,
	isLoading,
	className,
	valueClassName,
	skeletonClassName,
}: {
	label: string;
	value: React.ReactNode;
	detail?: React.ReactNode;
	isLoading?: boolean;
	className?: string;
	valueClassName?: string;
	skeletonClassName?: string;
}) {
	return (
		<div className={cn("flex min-w-0 flex-col bg-card px-4 py-3.5", className)}>
			<dt className="order-2 text-meta text-muted-foreground">{label}</dt>
			<dd
				className={cn(
					"order-1 font-bold whitespace-nowrap tabular-nums tracking-tight text-foreground",
					valueClassName,
				)}
			>
				{isLoading ? <Skeleton className={cn("my-1 h-6 w-20", skeletonClassName)} /> : value}
			</dd>
			{detail && !isLoading ? (
				<dd className="order-3 mt-0.5 text-meta text-muted-foreground tabular-nums">{detail}</dd>
			) : null}
		</div>
	);
}
