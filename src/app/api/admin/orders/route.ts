import { NextResponse } from "next/server";
import { adminRouteGuard } from "@/lib/auth/guards";
import { getCachedOrders } from "@/lib/order-lifecycle";

function isValidDateString(value: string | null): value is string {
	if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false;
	}

	const [year, month, day] = value.split("-").map(Number);
	const date = new Date(year, month - 1, day);
	return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export async function GET(request: Request) {
	const authError = await adminRouteGuard();
	if (authError) return authError;

	const { searchParams } = new URL(request.url);
	const dateString = searchParams.get("date");

	if (!isValidDateString(dateString)) {
		return NextResponse.json({ error: "Invalid date" }, { status: 400 });
	}

	const date = new Date(dateString);
	const data = await getCachedOrders(date);
	return NextResponse.json(data);
}
