import { NextResponse } from "next/server";

import { getCachedAllCombos, getCachedBaseDesserts, getCachedModifierDesserts } from "@/app/admin/combos/actions";
import { adminRouteGuard } from "@/lib/auth/guards";

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
