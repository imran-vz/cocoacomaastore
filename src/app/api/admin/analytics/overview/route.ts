import { NextResponse } from "next/server";
import { getAdminAnalyticsReport } from "@/app/admin/dashboard/actions";
import { adminRouteGuard } from "@/lib/auth/guards";

export async function GET() {
	const authError = await adminRouteGuard();
	if (authError) return authError;

	const { monthlyRevenue, availableMonths, initialMonth } = await getAdminAnalyticsReport();

	return NextResponse.json({
		monthlyRevenue,
		availableMonths,
		initialMonth,
	});
}
