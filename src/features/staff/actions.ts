"use server";

import { asc, eq } from "drizzle-orm";
import { userTable } from "@/db/schema";
import { adminAction } from "@/features/access/action";
import { areaOf, roleOf } from "@/features/access/area";
import { createStaffUser } from "@/features/staff/create-staff-user";
import { type NewStaffAccount, newStaffAccountSchema, staffAccountIdSchema } from "@/features/staff/schemas";
import { STAFF_TAGS } from "@/features/staff/tags";
import { UserFacingError } from "@/lib/errors";
import { writeAndRefresh } from "@/server/effect/write-and-refresh";
import { updateTags } from "@/server/next-cache";

export const createStaffAccount = adminAction(async (_admin, input: NewStaffAccount) => {
	await createStaffUser(newStaffAccountSchema.parse(input));
	updateTags(STAFF_TAGS);
});

/**
 * Every administrator row is locked first, in a fixed order, so two administrators deleting each
 * other at the same time can't both succeed and leave the store with none.
 */
export const deleteStaffAccount = adminAction(async (admin, id: string) => {
	const targetId = staffAccountIdSchema.parse(id);
	await writeAndRefresh("delete staff account", STAFF_TAGS, (db) =>
		db.transaction(async (tx) => {
			const administrators = await tx
				.select({ id: userTable.id })
				.from(userTable)
				.where(eq(userTable.role, roleOf("admin")))
				.orderBy(asc(userTable.id))
				.for("update");
			const administratorIds = new Set(administrators.map((row) => row.id));

			if (!administratorIds.has(admin.id)) {
				throw new UserFacingError("Your administrator account is no longer active");
			}
			if (admin.id === targetId) throw new UserFacingError("You cannot delete your own account");

			if (!administratorIds.has(targetId)) {
				const [target] = await tx
					.select({ role: userTable.role })
					.from(userTable)
					.where(eq(userTable.id, targetId))
					.for("update");
				if (!target) throw new UserFacingError("Account not found");
				if (areaOf(target.role) === "admin") {
					throw new UserFacingError("Administrator state changed; refresh and retry");
				}
			}

			const deleted = await tx.delete(userTable).where(eq(userTable.id, targetId)).returning({ id: userTable.id });
			if (deleted.length !== 1) throw new UserFacingError("Account not found");
		}),
	);
});
