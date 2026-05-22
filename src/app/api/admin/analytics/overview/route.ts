import { NextResponse } from "next/server";
import { getCachedAvailableMonths, getCachedMonthlyRevenue } from "@/app/admin/dashboard/actions";
import { adminRouteGuard } from "@/lib/auth/guards";

export async function GET() {
	const authError = await adminRouteGuard();
	if (authError) return authError;

	const [monthlyRevenue, availableMonths] = await Promise.all([
		getCachedMonthlyRevenue(12),
		getCachedAvailableMonths(),
	]);
	const initialMonth = availableMonths.length > 0 ? availableMonths[0] : new Date().toISOString().slice(0, 7);

	return NextResponse.json({
		monthlyRevenue,
		availableMonths,
		initialMonth,
	});
}
