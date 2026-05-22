import type { Metadata } from "next";
import { Suspense } from "react";
import {
	getCachedAvailableMonths,
	getCachedMonthlyDessertRevenue,
	getCachedMonthlyRevenue,
} from "@/app/admin/dashboard/actions";
import { AnalyticsSkeleton } from "../loading-skeletons";
import { AnalyticsContent } from "./analytics-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Analytics | Admin",
	description: "Monthly revenue, per-dessert insights, and stock trends",
};

export default async function AnalyticsPage() {
	const [monthlyRevenue, availableMonths] = await Promise.all([
		getCachedMonthlyRevenue(12),
		getCachedAvailableMonths(),
	]);

	// Get the most recent month for initial dessert revenue
	const currentMonth = availableMonths.length > 0 ? availableMonths[0] : new Date().toISOString().slice(0, 7);

	const monthlyDessertRevenue = await getCachedMonthlyDessertRevenue(currentMonth);

	return (
		<main className="min-h-[calc(100vh-52px)] p-4 pb-8 w-full max-w-7xl mx-auto">
			<Suspense fallback={<AnalyticsSkeleton includeMain={false} />}>
				<AnalyticsContent
					monthlyRevenue={monthlyRevenue}
					monthlyDessertRevenue={monthlyDessertRevenue}
					availableMonths={availableMonths}
					initialMonth={currentMonth}
				/>
			</Suspense>
		</main>
	);
}
