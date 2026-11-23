"use server";

import { and, eq } from "drizzle-orm";
import { upiAccountsTable } from "@/db/schema";
import { adminAction } from "@/features/access/action";
import { type UpiAccountInput, upiAccountIdSchema, upiAccountInputSchema } from "@/features/upi/schemas";
import { UPI_TAGS } from "@/features/upi/tags";
import { UserFacingError } from "@/lib/errors";
import { writeAndRefresh } from "@/server/effect/write-and-refresh";

const NOT_FOUND = "UPI account not found";

function liveAccount(id: string) {
	return and(eq(upiAccountsTable.id, upiAccountIdSchema.parse(id)), eq(upiAccountsTable.isDeleted, false));
}

export const createUpiAccount = adminAction(async (_admin, input: UpiAccountInput) => {
	const values = upiAccountInputSchema.parse(input);
	await writeAndRefresh("create UPI account", UPI_TAGS, (db) => db.insert(upiAccountsTable).values(values));
});

export const updateUpiAccount = adminAction(async (_admin, id: string, input: UpiAccountInput) => {
	const values = upiAccountInputSchema.parse(input);
	const where = liveAccount(id);
	await writeAndRefresh("update UPI account", UPI_TAGS, async (db) => {
		const updated = await db.update(upiAccountsTable).set(values).where(where).returning({ id: upiAccountsTable.id });
		if (updated.length === 0) throw new UserFacingError(NOT_FOUND);
	});
});

export const deleteUpiAccount = adminAction(async (_admin, id: string) => {
	const where = liveAccount(id);
	await writeAndRefresh("delete UPI account", UPI_TAGS, async (db) => {
		const deleted = await db
			.update(upiAccountsTable)
			.set({ isDeleted: true })
			.where(where)
			.returning({ id: upiAccountsTable.id });
		if (deleted.length === 0) throw new UserFacingError(NOT_FOUND);
	});
});
