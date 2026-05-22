import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
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
	const stats = getCachedDashboardStats();
	const stock = getCachedStockPerDessert();
	const auditLogs = getCachedAuditLogs();
	const dailyRevenue = getCachedDailyRevenue();

	return (
		<AdminPageShell>
			<Suspense fallback={<DashboardSkeleton includeMain={false} />}>
				<DashboardContent stats={stats} stock={stock} auditLogs={auditLogs} dailyRevenue={dailyRevenue} />
			</Suspense>
		</AdminPageShell>
	);
}
