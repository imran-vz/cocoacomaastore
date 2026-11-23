import { createHash, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { revalidateRequestSchema } from "@/features/insights/revalidate-request";
import { COMPILED_TAGS } from "@/features/insights/tags";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Compares digests so the time taken reveals neither the secret's length nor its prefix. With
 * no `REVALIDATE_SECRET` configured, no secret matches.
 */
function isServerSecret(secret: string) {
	const serverSecret = process.env.REVALIDATE_SECRET;
	if (!serverSecret) return false;
	return timingSafeEqual(digest(secret), digest(serverSecret));
}

/** Expires the compiled-analytics reads for the analytics job, which sends the shared secret instead of a session. */
export async function POST(request: Request) {
	const body = revalidateRequestSchema.safeParse(await request.json().catch(() => null));
	if (!body.success || !isServerSecret(body.data.secret)) {
		return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
	}

	// The job has just rewritten the compiled rows, so the next read must not be served the old report.
	for (const tag of COMPILED_TAGS) revalidateTag(tag, { expire: 0 });
	return NextResponse.json({ message: "Revalidated" });
}
