import { NextResponse } from "next/server";
import { getCachedMonthlyDessertRevenue } from "@/app/admin/dashboard/actions";
import { getServerSession } from "@/lib/auth";

function isValidMonth(value: string | null): value is string {
	return !!value && /^\d{4}-\d{2}$/.test(value);
}

export async function GET(request: Request) {
	const session = await getServerSession();
	if (!session?.session || !session.user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	if (session.user.role !== "admin") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const { searchParams } = new URL(request.url);
	const month = searchParams.get("month");

	if (!isValidMonth(month)) {
		return NextResponse.json({ error: "Invalid month" }, { status: 400 });
	}

	const data = await getCachedMonthlyDessertRevenue(month);
	return NextResponse.json(data);
}
