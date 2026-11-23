import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { upiAccountsTable } from "@/db/schema";
import { requireAdmin, requireStaff } from "@/features/access/session";
import type { AdminUpiAccount, CheckoutUpiAccount } from "@/features/upi/shapes";
import { UPI_TAGS } from "@/features/upi/tags";
import { TAGGED_READ_REVALIDATE_SECONDS } from "@/lib/cache-tags";

const cachedCheckoutAccounts = unstable_cache(
	(): Promise<CheckoutUpiAccount[]> =>
		db
			.select({ id: upiAccountsTable.id, label: upiAccountsTable.label, upiId: upiAccountsTable.upiId })
			.from(upiAccountsTable)
			.where(and(eq(upiAccountsTable.isDeleted, false), eq(upiAccountsTable.enabled, true)))
			.orderBy(asc(upiAccountsTable.createdAt)),
	["upi-checkout-accounts"],
	{
		revalidate: TAGGED_READ_REVALIDATE_SECONDS,
		tags: UPI_TAGS,
	},
);

/** The accounts the cart offers customers to pay to, oldest first. */
export async function getCheckoutUpiAccounts(): Promise<CheckoutUpiAccount[]> {
	await requireStaff();
	return cachedCheckoutAccounts();
}

/** Every UPI account, including those hidden from checkout, oldest first. */
export async function listUpiAccounts(): Promise<AdminUpiAccount[]> {
	await requireAdmin();
	const accounts = await db
		.select({
			id: upiAccountsTable.id,
			label: upiAccountsTable.label,
			upiId: upiAccountsTable.upiId,
			enabled: upiAccountsTable.enabled,
			createdAt: upiAccountsTable.createdAt,
		})
		.from(upiAccountsTable)
		.where(eq(upiAccountsTable.isDeleted, false))
		.orderBy(asc(upiAccountsTable.createdAt));
	return accounts.map((account) => ({ ...account, createdAt: account.createdAt.toISOString() }));
}
