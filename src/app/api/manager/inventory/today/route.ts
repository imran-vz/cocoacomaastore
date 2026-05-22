import { NextResponse } from "next/server";
import { getCachedTodayInventory } from "@/app/manager/inventory/actions";
import { managerRouteGuard } from "@/lib/auth/guards";

export async function GET() {
	const authError = await managerRouteGuard();
	if (authError) return authError;

	const data = await getCachedTodayInventory();
	return NextResponse.json(data);
}
