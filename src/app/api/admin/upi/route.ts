import { NextResponse } from "next/server";
import { getCachedAdminUpiAccounts } from "@/app/admin/settings/upi/actions";
import { adminRouteGuard } from "@/lib/auth/guards";

export async function GET() {
	const authError = await adminRouteGuard();
	if (authError) return authError;

	const accounts = await getCachedAdminUpiAccounts();
	return NextResponse.json(accounts);
}
