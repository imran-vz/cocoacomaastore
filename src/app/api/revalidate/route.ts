import { type NextRequest, NextResponse } from "next/server";
import { revalidateTagsEffect } from "@/server/effect/cache-tags";
import { runNextAppEffect } from "@/server/effect/next-runtime";

const serverSecret = process.env.REVALIDATE_SECRET;

if (!serverSecret) {
	throw new Error("REVALIDATE_SECRET environment variable is required for the revalidation API");
}

export async function POST(request: NextRequest) {
	const { tag, secret } = await request.json();
	if (secret !== serverSecret) {
		return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
	}

	await runNextAppEffect(revalidateTagsEffect([tag]));
	console.log(`Revalidated: ${tag}`);
	return NextResponse.json({ message: "Revalidated" });
}
