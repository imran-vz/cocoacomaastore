import type * as React from "react";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { InsightsHeader } from "@/components/admin/dashboard/insights-header";
import { ChartCardSkeleton } from "@/components/admin/dashboard/revenue-chart";
import { KpiSummarySkeleton } from "@/components/admin/dashboard/stats-card";
import { CatalogLinks } from "@/components/catalog-toolbar";
import { OrdersPageSkeleton } from "@/components/orders/orders-page-skeleton";
import { PosHomeSkeleton } from "@/components/pos-home-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/*
 * Loading states for the admin routes. Each one mirrors its page's redesigned layout
 * (PageHeader, flat stat grid, section headings over one rounded list card) so the swap
 * to real content doesn't jump. Pages pass `includeMain={false}` when they already render
 * `AdminPageShell` around their own Suspense boundary.
 */

function slots(count: number, prefix = "row") {
	return Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);
}

function withShell(
	content: React.ReactNode,
	includeMain: boolean,
	{ frame = "wide", className }: { frame?: "narrow" | "wide"; className?: string } = {},
) {
	return includeMain ? (
		<AdminPageShell frame={frame} className={className}>
			{content}
		</AdminPageShell>
	) : (
		content
	);
}

/** `PageHeader`: 22/26px title, optional description line, right-aligned controls, one row under it. */
function PageHeaderSkeleton({
	titleWidth = "w-32",
	description = false,
	secondary = false,
	action = false,
	children,
}: {
	titleWidth?: string;
	description?: boolean;
	/** The `⋯` overflow button next to the action. */
	secondary?: boolean;
	/** The primary action: a 44px icon button on phones, labelled from md. */
	action?: boolean;
	children?: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-4 pb-4 md:pb-6">
			<div className="flex min-h-11 items-center gap-3">
				<div className="min-w-0 flex-1">
					<Skeleton className={cn("my-0.5 h-6 max-w-full md:h-7", titleWidth)} />
					{description ? <Skeleton className="mt-1.5 h-4 w-56 max-w-full" /> : null}
				</div>
				{secondary || action ? (
					<div className="flex shrink-0 items-center gap-2">
						{secondary ? <Skeleton className="size-11 rounded-lg md:size-9" /> : null}
						{action ? <Skeleton className="size-11 rounded-lg md:h-9 md:w-32" /> : null}
					</div>
				) : null}
			</div>
			{children}
		</div>
	);
}

/** A segmented track (44px on phones, 36px from md). */
function SegmentedSkeleton({ className }: { className?: string }) {
	return <Skeleton className={cn("h-11 rounded-[10px] md:h-9", className)} />;
}

/** A 44px (36px from md) field or button. */
function FieldSkeleton({ className }: { className?: string }) {
	return <Skeleton className={cn("h-11 w-full rounded-lg md:h-9", className)} />;
}

/** `SectionHeading`: 15/600 title over its list. */
function SectionHeadingSkeleton({ width = "w-28", action }: { width?: string; action?: React.ReactNode }) {
	return (
		<div className="flex min-h-8 items-center justify-between gap-3 pb-2">
			<Skeleton className={cn("h-4", width)} />
			{action}
		</div>
	);
}

/** `RecordList` of `ListRow`s: one bordered card, divided 56px rows (text · chevron · trailing · action). */
function RecordListSkeleton({
	rows,
	leading = false,
	metaLines = 1,
	trailing = false,
	action,
	chevron = false,
}: {
	rows: number;
	leading?: boolean;
	metaLines?: 0 | 1 | 2;
	trailing?: boolean;
	action?: "switch" | "icon";
	chevron?: boolean;
}) {
	return (
		<div className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
			{slots(rows).map((slot) => (
				<div key={slot} className="flex min-h-14 items-center gap-3 py-3 pr-4 pl-4">
					{leading ? <Skeleton className="size-10 shrink-0 rounded-lg" /> : null}
					<div className="min-w-0 flex-1 space-y-2">
						<Skeleton className="h-4 w-40 max-w-full" />
						{metaLines >= 1 ? <Skeleton className="h-3 w-52 max-w-full" /> : null}
						{metaLines >= 2 ? <Skeleton className="h-3 w-32 max-w-full" /> : null}
					</div>
					{chevron ? <Skeleton className="size-4 shrink-0 rounded" /> : null}
					{trailing ? <Skeleton className="h-4 w-14 shrink-0" /> : null}
					{action === "switch" ? <Skeleton className="h-6 w-10 shrink-0 rounded-full md:h-[18px] md:w-8" /> : null}
					{action === "icon" ? <Skeleton className="size-6 shrink-0 rounded-md" /> : null}
				</div>
			))}
		</div>
	);
}

/** The date stepper (`DateSwitcher`): 44 · fill · 44 on phones, a 176px label from md. */
function DateStepperSkeleton() {
	return (
		<div className="flex w-full items-center gap-2 md:w-auto">
			<Skeleton className="size-11 shrink-0 rounded-lg md:size-9" />
			<Skeleton className="h-11 min-w-0 flex-1 rounded-lg md:h-9 md:w-44 md:flex-none" />
			<Skeleton className="size-11 shrink-0 rounded-lg md:size-9" />
		</div>
	);
}

/**
 * Generic route fallback for the `/admin` segment. Next shows the nearest loading boundary
 * it knows while a sibling route's own boundary hasn't been fetched yet (always in dev, and
 * on a tap before prefetch lands), so this stays neutral instead of flashing the Sell grid
 * on Orders or Insights. `/admin` itself streams `AdminHomeSkeleton` from its own Suspense.
 */
export function AdminRouteSkeleton() {
	return withShell(
		<div aria-hidden="true">
			<PageHeaderSkeleton />
			<RecordListSkeleton rows={6} />
		</div>,
		true,
	);
}

/** Sell (POS): search bar, tile grid, inline cart only on a wide pane. */
export function AdminHomeSkeleton({ includeMain = true }: { includeMain?: boolean } = {}) {
	return withShell(<PosHomeSkeleton />, includeMain, { className: "p-0 md:p-0" });
}

export function OrdersSkeleton({ includeMain = true }: { includeMain?: boolean } = {}) {
	return withShell(<OrdersPageSkeleton variant="admin" />, includeMain);
}

/**
 * Insights › Day. Uses the page's own header (title + Day | Month links) and P3's KPI and
 * chart placeholders, so the skeleton can't drift from the page.
 */
export function DashboardSkeleton({ includeMain = true }: { includeMain?: boolean } = {}) {
	return withShell(
		<div>
			<InsightsHeader>
				<DateStepperSkeleton />
			</InsightsHeader>
			<div className="space-y-6" aria-hidden="true">
				<KpiSummarySkeleton figures={3} />
				<section>
					<SectionHeadingSkeleton width="w-32" />
					<ChartCardSkeleton />
				</section>
				<div className="grid gap-6 @3xl/main:grid-cols-2 @3xl/main:items-start">
					<section>
						<SectionHeadingSkeleton width="w-24" />
						<RecordListSkeleton rows={3} trailing />
					</section>
					<section>
						<SectionHeadingSkeleton width="w-20" />
						<RecordListSkeleton rows={3} trailing />
					</section>
				</div>
			</div>
		</div>,
		includeMain,
	);
}

/** Insights › Month: range heading over the KPI strip, the trend chart, then Top desserts with its month select. */
export function AnalyticsSkeleton({ includeMain = true }: { includeMain?: boolean } = {}) {
	return withShell(
		<div>
			<InsightsHeader />
			<div className="space-y-6" aria-hidden="true">
				<section>
					<SectionHeadingSkeleton width="w-32" />
					<KpiSummarySkeleton figures={2} />
				</section>
				<section>
					<SectionHeadingSkeleton width="w-36" />
					<ChartCardSkeleton />
				</section>
				<section>
					<SectionHeadingSkeleton width="w-28" action={<FieldSkeleton className="w-44" />} />
					<div className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
						{slots(8).map((slot) => (
							<div key={slot} className="px-4 py-3">
								<div className="flex items-center gap-3">
									<Skeleton className="h-3 w-4 shrink-0" />
									<div className="min-w-0 flex-1 space-y-2">
										<Skeleton className="h-4 w-40 max-w-full" />
										<Skeleton className="h-3 w-24" />
									</div>
									<Skeleton className="h-4 w-16 shrink-0" />
								</div>
								<Skeleton className="mt-2 ml-7 h-1.5 rounded-full" />
							</div>
						))}
					</div>
				</section>
			</div>
		</div>,
		includeMain,
	);
}

/**
 * Catalog (Desserts and Combos share one layout): the `CatalogHeader` shape (title, stable
 * subtitle, `⋯` + Add), the real Desserts | Combos links, search, the full-width
 * Available | Hidden filter, then one list of tappable rows with a switch.
 */
function CatalogSkeleton() {
	return (
		<div>
			<PageHeaderSkeleton description secondary action>
				<CatalogLinks area="admin" />
			</PageHeaderSkeleton>
			<div className="flex flex-col gap-3 pb-4" aria-hidden="true">
				<FieldSkeleton />
				<SegmentedSkeleton className="w-full" />
			</div>
			<div aria-hidden="true">
				<RecordListSkeleton rows={8} chevron trailing action="switch" />
			</div>
		</div>
	);
}

export function DessertsSkeleton({ includeMain = true }: { includeMain?: boolean } = {}) {
	return withShell(<CatalogSkeleton />, includeMain, { frame: "narrow" });
}

export function CombosSkeleton({ includeMain = true }: { includeMain?: boolean } = {}) {
	return withShell(<CatalogSkeleton />, includeMain, { frame: "narrow" });
}

/** Managers / UPI accounts: header with Add, "Accounts n", rows with a tile and a delete action. */
function AccountsSkeleton({ rows, metaLines, chevron = false }: { rows: number; metaLines: 1 | 2; chevron?: boolean }) {
	return (
		<div aria-hidden="true">
			<PageHeaderSkeleton titleWidth="w-36" description action />
			<section>
				<SectionHeadingSkeleton width="w-24" />
				<RecordListSkeleton rows={rows} leading metaLines={metaLines} chevron={chevron} action="icon" />
			</section>
		</div>
	);
}

export function ManagersSkeleton({ includeMain = true }: { includeMain?: boolean } = {}) {
	return withShell(<AccountsSkeleton rows={5} metaLines={2} />, includeMain, { frame: "narrow" });
}

export function UpiAccountsSkeleton({ includeMain = true }: { includeMain?: boolean } = {}) {
	return withShell(<AccountsSkeleton rows={2} metaLines={2} chevron />, includeMain, { frame: "narrow" });
}

/** Settings: header, Store group (Managers, UPI accounts), Account row, Password card. */
export function SettingsSkeleton({ includeMain = true }: { includeMain?: boolean } = {}) {
	return withShell(
		<div aria-hidden="true">
			<PageHeaderSkeleton titleWidth="w-28" description />
			<div className="space-y-6">
				<section>
					<SectionHeadingSkeleton width="w-12" />
					<RecordListSkeleton rows={2} leading chevron />
				</section>
				<section>
					<SectionHeadingSkeleton width="w-16" />
					<RecordListSkeleton rows={1} leading trailing />
				</section>
				<section>
					<SectionHeadingSkeleton width="w-20" />
					<div className="space-y-4 rounded-xl border bg-card p-4 md:p-5">
						{slots(3, "field").map((slot) => (
							<div key={slot} className="space-y-2">
								<Skeleton className="h-4 w-32" />
								<FieldSkeleton />
							</div>
						))}
						<FieldSkeleton className="md:w-36" />
					</div>
				</section>
			</div>
		</div>,
		includeMain,
		{ frame: "narrow" },
	);
}
