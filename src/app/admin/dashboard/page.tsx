import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { DashboardSkeleton } from "../loading-skeletons";
import { getAdminDashboardReport } from "./actions";
import { DashboardContent } from "./dashboard-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Dashboard | Admin",
	description: "Monitor orders, revenue, stock and audit logs",
};

export default async function DashboardPage() {
	const report = getAdminDashboardReport();
	const stats = report.then((data) => data.stats);
	const stock = report.then((data) => data.stock);
	const auditLogs = report.then((data) => data.auditLogs);
	const dailyRevenue = report.then((data) => data.dailyRevenue);

	return (
		<AdminPageShell>
			<Suspense fallback={<DashboardSkeleton includeMain={false} />}>
				<DashboardContent stats={stats} stock={stock} auditLogs={auditLogs} dailyRevenue={dailyRevenue} />
			</Suspense>
		</AdminPageShell>
	);
}
