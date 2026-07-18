import { NextResponse } from "next/server";
import { adminRouteGuard } from "@/lib/auth/guards";
import { isValidDateString } from "@/lib/date-params";
import { getCachedOrders, serializeOrders } from "@/lib/order-lifecycle";

export async function GET(request: Request) {
	const authError = await adminRouteGuard();
	if (authError) return authError;

	const { searchParams } = new URL(request.url);
	const dateString = searchParams.get("date");

	if (!isValidDateString(dateString)) {
		return NextResponse.json({ error: "Invalid date" }, { status: 400 });
	}

	const date = new Date(dateString);
	const data = serializeOrders(await getCachedOrders(date));
	return NextResponse.json(data);
}
