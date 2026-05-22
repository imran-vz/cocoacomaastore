"use server";

import { requireSession } from "@/lib/auth/guards";
import { updateTagsEffect } from "@/server/effect/cache-tags";
import { runNextAppEffect } from "@/server/effect/next-runtime";

const ALL_CACHE_TAGS = [
	"desserts",
	"combos",
	"inventory",
	"orders",
	"upi-accounts",
	"upi-accounts-admin",
	"managers",
	"dashboard",
	"analytics",
] as const;

export async function revalidateAllCaches() {
	await requireSession();

	await runNextAppEffect(updateTagsEffect(ALL_CACHE_TAGS));
}
