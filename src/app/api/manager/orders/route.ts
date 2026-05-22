import { NextResponse } from "next/server";
import { getCachedOrders } from "@/app/manager/orders/actions";
import { managerRouteGuard } from "@/lib/auth/guards";

export async function GET() {
	const authError = await managerRouteGuard();
	if (authError) return authError;

	const data = await getCachedOrders();
	return NextResponse.json(data);
}
