import { NextResponse } from "next/server";
import { adminRouteGuard } from "@/lib/auth/guards";
import { getCachedAllCombos, getCachedBaseDesserts, getCachedModifierDesserts } from "@/lib/role-actions/admin-combos";

export async function GET() {
	const authError = await adminRouteGuard();
	if (authError) return authError;

	const [combos, baseDesserts, modifierDesserts] = await Promise.all([
		getCachedAllCombos(),
		getCachedBaseDesserts(),
		getCachedModifierDesserts(),
	]);

	return NextResponse.json({ combos, baseDesserts, modifierDesserts });
}
