"use server";

import { and, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { db } from "@/db";
import { upiAccountsTable } from "@/db/schema";
import { CacheTag } from "@/server/effect/cache-tags";

async function getUPIAccountsForAdmin() {
	// Get enabled UPI accounts from database, sorted by sequence
	const accounts = await db.query.upiAccountsTable.findMany({
		where: eq(upiAccountsTable.isDeleted, false),
		orderBy: (accounts, { asc }) => [asc(accounts.sequence)],
	});

	return accounts;
}

async function getUPIAccounts() {
	// Get enabled UPI accounts from database, sorted by sequence
	const accounts = await db.query.upiAccountsTable.findMany({
		where: and(eq(upiAccountsTable.isDeleted, false), eq(upiAccountsTable.enabled, true)),
		orderBy: (accounts, { asc }) => [asc(accounts.sequence)],
	});

	return accounts;
}

export const getCachedUPIAccounts = unstable_cache(getUPIAccounts, [CacheTag.upiAccounts], {
	revalidate: 60 * 60 * 24, // 24 hours
	tags: [CacheTag.upiAccounts],
});

export const getCachedUPIAccountsForAdmin = unstable_cache(getUPIAccountsForAdmin, [CacheTag.upiAccounts], {
	revalidate: 60 * 60 * 24, // 24 hours
	tags: [CacheTag.upiAccounts],
});
