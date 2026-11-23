import type { Metadata } from "next";
import { AnalyticsContent } from "@/features/insights/analytics-content";
import { getAnalyticsOverview, getDessertSales } from "@/features/insights/reporting";
import { pageMetadata } from "@/features/shell/routes";
import { snapshot } from "@/lib/server-snapshot";

export const metadata: Metadata = pageMetadata("/admin/analytics");

export default function AnalyticsPage() {
	const overview = getAnalyticsOverview();
	const desserts = overview.then((data) => getDessertSales(data.latestMonth));

	return <AnalyticsContent overview={snapshot(overview)} desserts={snapshot(desserts)} />;
}
