import { NextResponse } from "next/server";

import { getCachedDesserts } from "@/app/desserts/actions";
import { getServerSession } from "@/lib/auth";

export async function GET(request: Request) {
	const session = await getServerSession();
	if (!session?.session || !session?.user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { searchParams } = new URL(request.url);
	const shouldShowDisabled = searchParams.get("shouldShowDisabled") === "true";
	const data = await getCachedDesserts({ shouldShowDisabled });

	return NextResponse.json(data);
}
