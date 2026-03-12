"use server";

import { revalidateTag } from "next/cache";
import { getServerSession } from "@/lib/auth";

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
	const session = await getServerSession();
	if (!session?.session || !session?.user) {
		throw new Error("Unauthorized");
	}

	for (const tag of ALL_CACHE_TAGS) {
		revalidateTag(tag, "max");
	}
}
