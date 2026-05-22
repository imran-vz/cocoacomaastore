"use server";

import { requireSession } from "@/lib/auth/guards";
import { AllCacheTags, updateTagsEffect } from "@/server/effect/cache-tags";
import { runNextAppEffect } from "@/server/effect/next-runtime";

export async function revalidateAllCaches() {
	await requireSession();

	await runNextAppEffect(updateTagsEffect(AllCacheTags));
}
