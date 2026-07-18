import { NextResponse } from "next/server";
import { managerRouteGuard } from "@/lib/auth/guards";
import {
	getCachedAllCombos,
	getCachedBaseDesserts,
	getCachedModifierDesserts,
} from "@/lib/role-actions/manager-combos";

export async function GET() {
	const authError = await managerRouteGuard();
	if (authError) return authError;

	const [combos, baseDesserts, modifierDesserts] = await Promise.all([
		getCachedAllCombos(),
		getCachedBaseDesserts(),
		getCachedModifierDesserts(),
	]);

	return NextResponse.json({ combos, baseDesserts, modifierDesserts });
}
