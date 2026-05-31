import type { Metadata } from "next";
import { Suspense } from "react";
import { getAdminAnalyticsReport } from "@/app/admin/dashboard/actions";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { AnalyticsSkeleton } from "../loading-skeletons";
import { AnalyticsContent } from "./analytics-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Analytics | Admin",
	description: "Monthly revenue, per-dessert insights, and stock trends",
};

export default async function AnalyticsPage() {
	const report = getAdminAnalyticsReport();
	const monthlyRevenue = report.then((data) => data.monthlyRevenue);
	const availableMonths = report.then((data) => data.availableMonths);
	const currentMonth = report.then((data) => data.initialMonth);
	const monthlyDessertRevenue = report.then((data) => data.monthlyDessertRevenue);

	return (
		<AdminPageShell>
			<Suspense fallback={<AnalyticsSkeleton includeMain={false} />}>
				<AnalyticsContent
					monthlyRevenue={monthlyRevenue}
					monthlyDessertRevenue={monthlyDessertRevenue}
					availableMonths={availableMonths}
					initialMonth={currentMonth}
				/>
			</Suspense>
		</AdminPageShell>
	);
}
