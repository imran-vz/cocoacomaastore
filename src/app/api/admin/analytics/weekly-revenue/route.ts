import { NextResponse } from "next/server";
import { getCachedWeeklyRevenue } from "@/app/admin/dashboard/actions";
import { adminRouteGuard } from "@/lib/auth/guards";

function isValidMonth(value: string | null): value is string {
	return !!value && /^\d{4}-\d{2}$/.test(value);
}

export async function GET(request: Request) {
	const authError = await adminRouteGuard();
	if (authError) return authError;

	const { searchParams } = new URL(request.url);
	const month = searchParams.get("month");

	if (!isValidMonth(month)) {
		return NextResponse.json({ error: "Invalid month" }, { status: 400 });
	}

	const data = await getCachedWeeklyRevenue(month);
	return NextResponse.json(data);
}
