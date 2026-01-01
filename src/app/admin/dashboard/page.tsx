import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import {
	getCachedAuditLogs,
	getCachedDailyRevenue,
	getCachedDashboardStats,
	getCachedStockPerDessert,
} from "./actions";
import { DashboardContent } from "./dashboard-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Dashboard | Admin",
	description: "Monitor orders, revenue, stock and audit logs",
};

function DashboardSkeleton() {
	return (
		<div className="space-y-6 p-4">
			{/* Stats skeleton */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<Skeleton className="h-28 rounded-xl" />
				<Skeleton className="h-28 rounded-xl" />
				<Skeleton className="h-28 rounded-xl" />
				<Skeleton className="h-28 rounded-xl" />
			</div>

			{/* Chart skeleton */}
			<Skeleton className="h-64 rounded-xl" />

			{/* Stock and Audit log skeleton */}
			<div className="grid md:grid-cols-2 gap-6">
				<Skeleton className="h-80 rounded-xl" />
				<Skeleton className="h-80 rounded-xl" />
			</div>
		</div>
	);
}

export default async function DashboardPage() {
	const [stats, stock, auditLogs, dailyRevenue] = await Promise.all([
		getCachedDashboardStats(),
		getCachedStockPerDessert(),
		getCachedAuditLogs(),
		getCachedDailyRevenue(),
	]);

	return (
		<main className="min-h-[calc(100vh-52px)] p-4 pb-8 w-full max-w-6xl mx-auto">
			<Suspense fallback={<DashboardSkeleton />}>
				<DashboardContent
					stats={stats}
					stock={stock}
					auditLogs={auditLogs}
					dailyRevenue={dailyRevenue}
				/>
			</Suspense>
		</main>
	);
}
