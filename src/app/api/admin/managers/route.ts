import { NextResponse } from "next/server";
import { getCachedManagers } from "@/app/admin/settings/managers/actions";
import { adminRouteGuard } from "@/lib/auth/guards";

export async function GET() {
	const authError = await adminRouteGuard();
	if (authError) return authError;

	const managers = await getCachedManagers();
	return NextResponse.json(managers);
}
