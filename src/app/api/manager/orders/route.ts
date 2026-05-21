import { NextResponse } from "next/server";
import { getCachedOrders } from "@/app/manager/orders/actions";
import { getServerSession } from "@/lib/auth";

export async function GET() {
	const session = await getServerSession();
	if (!session?.session || !session.user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	if (session.user.role !== "admin" && session.user.role !== "user") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const data = await getCachedOrders();
	return NextResponse.json(data);
}
