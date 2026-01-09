import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

const serverSecret = process.env.REVALIDATE_SECRET;

if (!serverSecret) {
	throw new Error(
		"REVALIDATE_SECRET environment variable is required for the revalidation API",
	);
}

export async function POST(request: NextRequest) {
	const { tag, secret } = await request.json();
	if (secret !== serverSecret) {
		return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
	}

	revalidateTag(tag, "max");
	console.log(`Revalidated: ${tag}`);
	return NextResponse.json({ message: "Revalidated" });
}
