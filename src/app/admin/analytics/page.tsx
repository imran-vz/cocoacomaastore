import type { Metadata } from "next";
import { Suspense } from "react";
import {
	getCachedAvailableMonths,
	getCachedMonthlyDessertRevenue,
	getCachedMonthlyRevenue,
} from "@/app/admin/dashboard/actions";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { AnalyticsSkeleton } from "../loading-skeletons";
import { AnalyticsContent } from "./analytics-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Analytics | Admin",
	description: "Monthly revenue, per-dessert insights, and stock trends",
};

export default async function AnalyticsPage() {
	const monthlyRevenue = getCachedMonthlyRevenue(12);
	const availableMonths = getCachedAvailableMonths();

	// Get the most recent month for initial dessert revenue
	const currentMonth = availableMonths.then((months) =>
		months.length > 0 ? months[0] : new Date().toISOString().slice(0, 7),
	);

	const monthlyDessertRevenue = currentMonth.then((month) => getCachedMonthlyDessertRevenue(month));

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
