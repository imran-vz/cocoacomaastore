import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardSkeleton } from "../loading-skeletons";
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

export default async function DashboardPage() {
	const [stats, stock, auditLogs, dailyRevenue] = await Promise.all([
		getCachedDashboardStats(),
		getCachedStockPerDessert(),
		getCachedAuditLogs(),
		getCachedDailyRevenue(),
	]);

	return (
		<main className="min-h-[calc(100vh-52px)] p-4 pb-8 w-full max-w-6xl mx-auto">
			<Suspense fallback={<DashboardSkeleton includeMain={false} />}>
				<DashboardContent stats={stats} stock={stock} auditLogs={auditLogs} dailyRevenue={dailyRevenue} />
			</Suspense>
		</main>
	);
}
