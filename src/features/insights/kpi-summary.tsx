import type * as React from "react";
import { Skeleton, skeletonSlots } from "@/components/ui/skeleton";
import { Stat, StatGrid, statGridClass } from "@/components/ui/stat";
import type { Totals } from "@/features/insights/shapes";
import { formatPercent, formatSigned } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Grid columns for a lead figure plus `count` supporting figures; `long` figures stack on phones. */
function kpiColumns(count: number, long: boolean) {
	if (long) return count === 3 ? "grid-cols-1 @md:grid-cols-3" : "grid-cols-1 @md:grid-cols-2";
	return count === 3 ? "grid-cols-3 @3xl:grid-cols-5" : "grid-cols-2 @3xl:grid-cols-4";
}

/** Revenue per order, or 0 without orders. */
export function averageOrderValue({ revenue, orders }: Totals): number {
	return orders > 0 ? revenue / orders : 0;
}

export type KpiFigure = {
	label: string;
	value: string;
	/** A real comparison (`KpiDelta`) or nothing. Never the same figure again. */
	detail?: React.ReactNode;
};

/**
 * The Insights summary: one lead figure (Revenue) and two or three supporting figures, as
 * one flat card. The grid answers to its own width (a size container), not the viewport:
 *
 * - narrow (< 768px of card): the lead takes the full width at 28px; the others share
 *   one row at 20px. ₹12,00,882 and crore amounts fit at 360px.
 * - wide: one row, the lead in a double-width cell, all at 28px.
 * - a supporting figure too long for its share of a 360px row (over 7 characters in a
 *   row of three, 10 in a row of two): the lead stays full width at every size and the
 *   others stack on phones, sharing a row only from 448px of card.
 */
export function KpiSummary({
	lead,
	figures,
	isLoading,
	className,
	...props
}: Omit<React.ComponentProps<"dl">, "children"> & {
	lead: KpiFigure;
	figures: KpiFigure[];
	isLoading?: boolean;
}) {
	const three = figures.length === 3;
	const long = figures.some((figure) => figure.value.length > (three ? 7 : 10));
	return (
		<div className={cn("@container", className)}>
			<StatGrid
				data-slot="kpi-summary"
				data-long={long || undefined}
				className={kpiColumns(figures.length, long)}
				{...props}
			>
				<Stat
					{...lead}
					isLoading={isLoading}
					className={cn("col-span-full @3xl:py-4", !long && "@3xl:col-span-2")}
					valueClassName="text-[28px] leading-9"
					skeletonClassName="my-1.5 w-32"
				/>
				{figures.map((figure) => (
					<Stat
						key={figure.label}
						{...figure}
						isLoading={isLoading}
						className="@max-3xl:px-3 @3xl:py-4"
						valueClassName={cn("text-xl leading-7", !long && "@3xl:text-[28px] @3xl:leading-9")}
						skeletonClassName="my-1.5 h-5 w-14 @3xl:h-6"
					/>
				))}
			</StatGrid>
		</div>
	);
}

/**
 * A signed comparison against a named earlier period: "+12% vs Sun 22 Nov". The change is
 * a status colour (success up, destructive down); the period stays muted. Name the period
 * once, on the lead figure; the supporting figures show only the change (`showPeriod={false}`
 * keeps the period for screen readers). Callers render nothing at all when there is no
 * earlier figure to compare with.
 */
export function KpiDelta({
	ratio,
	against,
	showPeriod = true,
}: {
	ratio: number;
	against: string;
	showPeriod?: boolean;
}) {
	const change = formatSigned(ratio, formatPercent);
	const direction = change === formatPercent(0) ? "flat" : ratio > 0 ? "up" : "down";
	return (
		<>
			<span
				className={cn(
					"font-semibold",
					direction === "up" && "text-success",
					direction === "down" && "text-destructive",
				)}
			>
				{change}
			</span>{" "}
			<span className={showPeriod ? undefined : "sr-only"}>vs {against}</span>
		</>
	);
}

/** Loading placeholder with the same shape as `KpiSummary` (for route skeletons). */
export function KpiSummarySkeleton({ figures = 3, className }: { figures?: 2 | 3; className?: string }) {
	const columns = kpiColumns(figures, false);
	return (
		<div className={cn("@container", className)} aria-hidden="true">
			<div className={cn(statGridClass, columns)}>
				<div className="col-span-full flex flex-col gap-2 bg-card px-4 py-3.5 @3xl:col-span-2 @3xl:py-4">
					<Skeleton className="my-1.5 h-6 w-32" />
					<Skeleton className="h-3.5 w-16" />
				</div>
				{skeletonSlots(figures, "kpi").map((slot) => (
					<div key={slot} className="flex flex-col gap-2 bg-card px-3 py-3.5 @3xl:px-4 @3xl:py-4">
						<Skeleton className="my-1 h-5 w-14 @3xl:h-6" />
						<Skeleton className="h-3.5 w-16" />
					</div>
				))}
			</div>
		</div>
	);
}
