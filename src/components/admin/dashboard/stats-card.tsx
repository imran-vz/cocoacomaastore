import type * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Flat KPI grid (DESIGN.md §Type, "KPI value"): one opaque card, cells divided by
 * hairlines (the `bg-border` showing through `gap-px`), no card per KPI. Two columns on
 * phones; pass wider column counts through `className` (e.g. `lg:grid-cols-4`).
 *
 * Used by the compact summary strip on Orders. Insights uses `KpiSummary`, which gives
 * the lead figure its own full-width cell so it never truncates.
 */
export function StatGrid({ className, children, ...props }: React.ComponentProps<"dl">) {
	return (
		<dl
			data-slot="stat-grid"
			className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border", className)}
			{...props}
		>
			{children}
		</dl>
	);
}

/**
 * One KPI: the value (tabular, 24–28/700) over a 13px muted sentence-case label and one
 * optional supporting line. `size="compact"` is the summary strip on Orders.
 *
 * Values never truncate: a cell that is too narrow for its figure is a layout bug, fixed
 * by giving the figure more room (see `KpiSummary`), never by an ellipsis.
 */
export function Stat({
	label,
	value,
	detail,
	isLoading,
	size = "default",
	className,
}: {
	label: string;
	value: React.ReactNode;
	detail?: React.ReactNode;
	isLoading?: boolean;
	size?: "default" | "compact";
	className?: string;
}) {
	const compact = size === "compact";
	return (
		<div
			className={cn(
				"flex min-w-0 flex-col bg-card",
				compact ? "px-3 py-2.5 md:px-4 md:py-3" : "px-4 py-3.5",
				className,
			)}
		>
			<dt className="order-2 text-[13px] leading-[18px] text-muted-foreground">{label}</dt>
			<dd
				className={cn(
					"order-1 font-bold whitespace-nowrap tabular-nums tracking-tight text-foreground",
					compact ? "text-xl leading-7 md:text-2xl md:leading-8" : "text-2xl leading-8 md:text-[28px] md:leading-9",
				)}
			>
				{isLoading ? <Skeleton className={cn("my-1 w-20", compact ? "h-5" : "h-6")} /> : value}
			</dd>
			{detail ? (
				<dd className="order-3 mt-0.5 text-xs leading-4 text-muted-foreground tabular-nums">{detail}</dd>
			) : null}
		</div>
	);
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
	const columns = long
		? three
			? "grid-cols-1 @md:grid-cols-3"
			: "grid-cols-1 @md:grid-cols-2"
		: three
			? "grid-cols-3 @3xl:grid-cols-5"
			: "grid-cols-2 @3xl:grid-cols-4";
	return (
		<div className={cn("@container", className)}>
			<dl
				data-slot="kpi-summary"
				data-long={long || undefined}
				className={cn("grid gap-px overflow-hidden rounded-xl border bg-border", columns)}
				{...props}
			>
				<KpiCell figure={lead} isLoading={isLoading} lead className={cn("col-span-full", !long && "@3xl:col-span-2")} />
				{figures.map((figure) => (
					<KpiCell key={figure.label} figure={figure} isLoading={isLoading} compact={long} />
				))}
			</dl>
		</div>
	);
}

function KpiCell({
	figure,
	isLoading,
	lead = false,
	compact = false,
	className,
}: {
	figure: KpiFigure;
	isLoading?: boolean;
	lead?: boolean;
	/** Keep the 20px supporting size at every width (long figures). */
	compact?: boolean;
	className?: string;
}) {
	return (
		<div className={cn("flex min-w-0 flex-col bg-card px-4 py-3.5 @3xl:py-4", !lead && "@max-3xl:px-3", className)}>
			<dt className="order-2 text-[13px] leading-[18px] text-muted-foreground">{figure.label}</dt>
			<dd
				className={cn(
					"order-1 font-bold whitespace-nowrap tabular-nums tracking-tight text-foreground",
					lead
						? "text-[28px] leading-9"
						: compact
							? "text-xl leading-7"
							: "text-xl leading-7 @3xl:text-[28px] @3xl:leading-9",
				)}
			>
				{isLoading ? <Skeleton className={cn("my-1.5", lead ? "h-6 w-32" : "h-5 w-14 @3xl:h-6")} /> : figure.value}
			</dd>
			{figure.detail && !isLoading ? (
				<dd className="order-3 mt-0.5 text-[13px] leading-[18px] text-muted-foreground tabular-nums">
					{figure.detail}
				</dd>
			) : null}
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
	const percent = Math.round(Math.abs(ratio) * 100);
	const direction = percent === 0 ? "flat" : ratio > 0 ? "up" : "down";
	const sign = direction === "up" ? "+" : direction === "down" ? "\u2212" : "";
	return (
		<>
			<span
				className={cn(
					"font-semibold",
					direction === "up" && "text-success",
					direction === "down" && "text-destructive",
				)}
			>
				{sign}
				{formatPercent(percent / 100)}
			</span>{" "}
			<span className={showPeriod ? undefined : "sr-only"}>vs {against}</span>
		</>
	);
}

/** Loading placeholder with the same shape as `KpiSummary` (for route skeletons). */
export function KpiSummarySkeleton({ figures = 3, className }: { figures?: 2 | 3; className?: string }) {
	const columns = figures === 3 ? "grid-cols-3 @3xl:grid-cols-5" : "grid-cols-2 @3xl:grid-cols-4";
	return (
		<div className={cn("@container", className)} aria-hidden="true">
			<div className={cn("grid gap-px overflow-hidden rounded-xl border bg-border", columns)}>
				<div className="col-span-full flex flex-col gap-2 bg-card px-4 py-3.5 @3xl:col-span-2 @3xl:py-4">
					<Skeleton className="my-1.5 h-6 w-32" />
					<Skeleton className="h-3.5 w-16" />
				</div>
				{Array.from({ length: figures }, (_, index) => `kpi-${index}`).map((slot) => (
					<div key={slot} className="flex flex-col gap-2 bg-card px-3 py-3.5 @3xl:px-4 @3xl:py-4">
						<Skeleton className="my-1 h-5 w-14 @3xl:h-6" />
						<Skeleton className="h-3.5 w-16" />
					</div>
				))}
			</div>
		</div>
	);
}

export default Stat;
