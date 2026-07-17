import { NextResponse } from "next/server";
import { getOrders } from "@/app/manager/orders/actions";
import { managerRouteGuard } from "@/lib/auth/guards";

export async function GET() {
	const authError = await managerRouteGuard();
	if (authError) return authError;

	const data = await getOrders();
	return NextResponse.json(data);
}
