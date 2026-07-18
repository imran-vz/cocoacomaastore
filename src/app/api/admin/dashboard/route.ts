import { NextResponse } from "next/server";
import { getAdminDashboardReport } from "@/app/admin/dashboard/actions";
import { adminRouteGuard } from "@/lib/auth/guards";
import { isValidDateString } from "@/lib/date-params";

export async function GET(request: Request) {
	const authError = await adminRouteGuard();
	if (authError) return authError;

	const { searchParams } = new URL(request.url);
	const dateString = searchParams.get("date");

	if (!isValidDateString(dateString)) {
		return NextResponse.json({ error: "Invalid date" }, { status: 400 });
	}

	if (request.signal.aborted) {
		return NextResponse.json({ error: "Request aborted" }, { status: 499 });
	}

	const report = await getAdminDashboardReport(dateString);

	if (request.signal.aborted) {
		return NextResponse.json({ error: "Request aborted" }, { status: 499 });
	}

	return NextResponse.json(report);
}
