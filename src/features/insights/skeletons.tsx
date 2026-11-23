import { DateSwitcherSkeleton } from "@/components/ui/date-switcher";
import { RecordListSkeleton } from "@/components/ui/list-row";
import { SectionHeadingSkeleton } from "@/components/ui/section-heading";
import { FieldSkeleton } from "@/components/ui/skeleton";
import { InsightsHeader } from "@/features/insights/insights-header";
import { KpiSummarySkeleton } from "@/features/insights/kpi-summary";
import { ChartCardSkeleton } from "@/features/insights/revenue-chart";

/** Insights › Day, built from the page's own header, KPI and chart placeholders. */
export function DashboardSkeleton() {
	return (
		<div>
			<InsightsHeader>
				<DateSwitcherSkeleton />
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
		</div>
	);
}

/** Insights › Month: range heading over the KPI strip, the trend chart, then Top desserts with its month select. */
export function AnalyticsSkeleton() {
	return (
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
					<RecordListSkeleton rows={8} trailing />
				</section>
			</div>
		</div>
	);
}
