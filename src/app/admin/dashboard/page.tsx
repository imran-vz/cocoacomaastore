import type { Metadata } from "next";
import { REPORT_DAY_PARAM } from "@/features/insights/client";
import { DashboardContent } from "@/features/insights/dashboard-content";
import { getDashboardReport } from "@/features/insights/reporting";
import { pageMetadata } from "@/features/shell/routes";
import { snapshot } from "@/lib/server-snapshot";
import { parseDayKey } from "@/lib/shop-calendar";

export const metadata: Metadata = pageMetadata("/admin/dashboard");

export default function DashboardPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const report = searchParams.then((params) => {
		const picked = params[REPORT_DAY_PARAM];
		return snapshot(getDashboardReport(parseDayKey(typeof picked === "string" ? picked : null) ?? undefined));
	});
	return <DashboardContent report={report} />;
}
