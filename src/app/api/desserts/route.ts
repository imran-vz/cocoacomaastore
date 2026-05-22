import { NextResponse } from "next/server";

import { getCachedDesserts } from "@/app/desserts/actions";
import { authenticatedRouteGuard } from "@/lib/auth/guards";

export async function GET(request: Request) {
	const authError = await authenticatedRouteGuard();
	if (authError) return authError;

	const { searchParams } = new URL(request.url);
	const shouldShowDisabled = searchParams.get("shouldShowDisabled") === "true";
	const data = await getCachedDesserts({ shouldShowDisabled });

	return NextResponse.json(data);
}
