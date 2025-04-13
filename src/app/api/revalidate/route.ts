import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

const serverSecret = process.env.REVALIDATE_SECRET || "my-secret";

export async function POST(request: NextRequest) {
	const { tag, secret } = await request.json();
	if (secret !== serverSecret) {
		return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
	}

	revalidateTag(tag);
	console.log(`Revalidated: ${tag}`);
	return NextResponse.json({ message: "Revalidated" });
}
