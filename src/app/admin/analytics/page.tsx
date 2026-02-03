import type { Metadata } from "next";
import { Suspense } from "react";
import {
	getCachedAvailableMonths,
	getCachedEodStockTrends,
	getCachedMonthlyDessertRevenue,
	getCachedMonthlyRevenue,
} from "@/app/admin/dashboard/actions";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalyticsContent } from "./analytics-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Analytics | Admin",
	description: "Monthly revenue, per-dessert insights, and stock trends",
};

function AnalyticsSkeleton() {
	return (
		<div className="space-y-6 p-4">
			{/* Monthly revenue chart skeleton */}
			<Skeleton className="h-80 rounded-xl" />

			{/* Per-dessert revenue skeleton */}
			<div className="grid md:grid-cols-2 gap-6">
				<Skeleton className="h-96 rounded-xl" />
				<Skeleton className="h-96 rounded-xl" />
			</div>
		</div>
	);
}

export default async function AnalyticsPage() {
	const [monthlyRevenue, availableMonths, eodStockTrends] = await Promise.all([
		getCachedMonthlyRevenue(12),
		getCachedAvailableMonths(),
		getCachedEodStockTrends(14),
	]);

	// Get the most recent month for initial dessert revenue
	const currentMonth =
		availableMonths.length > 0
			? availableMonths[0]
			: new Date().toISOString().slice(0, 7);

	const monthlyDessertRevenue =
		await getCachedMonthlyDessertRevenue(currentMonth);

	return (
		<main className="min-h-[calc(100vh-52px)] p-4 pb-8 w-full max-w-7xl mx-auto">
			<Suspense fallback={<AnalyticsSkeleton />}>
				<AnalyticsContent
					monthlyRevenue={monthlyRevenue}
					monthlyDessertRevenue={monthlyDessertRevenue}
					availableMonths={availableMonths}
					initialMonth={currentMonth}
					eodStockTrends={eodStockTrends}
				/>
			</Suspense>
		</main>
	);
}
