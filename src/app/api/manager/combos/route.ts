import { NextResponse } from "next/server";

import { getCachedAllCombos, getCachedBaseDesserts, getCachedModifierDesserts } from "@/app/manager/combos/actions";
import { getServerSession } from "@/lib/auth";

export async function GET() {
	const session = await getServerSession();
	if (!session?.session || !session?.user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	if (session.user.role !== "admin" && session.user.role !== "user") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const [combos, baseDesserts, modifierDesserts] = await Promise.all([
		getCachedAllCombos(),
		getCachedBaseDesserts(),
		getCachedModifierDesserts(),
	]);

	return NextResponse.json({ combos, baseDesserts, modifierDesserts });
}
