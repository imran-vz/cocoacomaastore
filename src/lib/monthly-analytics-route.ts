import { NextResponse } from "next/server";
import { adminRouteGuard } from "@/lib/auth/guards";
import { isValidMonth } from "@/lib/date-params";

/**
 * Admin-guarded GET handler for analytics endpoints keyed by a ?month=YYYY-MM param.
 */
export function createMonthlyAnalyticsGET(fetchData: (month: string) => Promise<unknown>) {
	return async function GET(request: Request) {
		const authError = await adminRouteGuard();
		if (authError) return authError;

		const { searchParams } = new URL(request.url);
		const month = searchParams.get("month");

		if (!isValidMonth(month)) {
			return NextResponse.json({ error: "Invalid month" }, { status: 400 });
		}

		const data = await fetchData(month);
		return NextResponse.json(data);
	};
}
