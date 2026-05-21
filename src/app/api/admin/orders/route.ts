import { NextResponse } from "next/server";
import { getCachedOrders } from "@/app/admin/orders/actions";
import { getServerSession } from "@/lib/auth";

function isValidDateString(value: string | null): value is string {
	if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false;
	}

	const [year, month, day] = value.split("-").map(Number);
	const date = new Date(year, month - 1, day);
	return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export async function GET(request: Request) {
	const session = await getServerSession();
	if (!session?.session || !session.user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	if (session.user.role !== "admin") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const { searchParams } = new URL(request.url);
	const dateString = searchParams.get("date");

	if (!isValidDateString(dateString)) {
		return NextResponse.json({ error: "Invalid date" }, { status: 400 });
	}

	const data = await getCachedOrders(dateString);
	return NextResponse.json(data);
}
