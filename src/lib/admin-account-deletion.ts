import { asc, eq } from "drizzle-orm";
import type { db as applicationDatabase } from "@/db";
import { userTable } from "@/db/schema";

export type DeleteManagerResult = { success: true } | { success: false; error: string };

export async function deleteManagerAccount(
	database: typeof applicationDatabase,
	actorId: string,
	targetId: string,
): Promise<DeleteManagerResult> {
	return database.transaction(async (transaction) => {
		const administrators = await transaction
			.select({ id: userTable.id })
			.from(userTable)
			.where(eq(userTable.role, "admin"))
			.orderBy(asc(userTable.id))
			.for("update");
		const administratorIds = new Set(administrators.map(({ id }) => id));

		if (!administratorIds.has(actorId)) {
			return { success: false, error: "Your administrator account is no longer active" };
		}
		if (actorId === targetId) {
			return { success: false, error: "You cannot delete your own account" };
		}

		if (!administratorIds.has(targetId)) {
			const [target] = await transaction
				.select({ id: userTable.id, role: userTable.role })
				.from(userTable)
				.where(eq(userTable.id, targetId))
				.for("update");

			if (!target) return { success: false, error: "Manager not found" };
			if (target.role === "admin") {
				return { success: false, error: "Administrator state changed; refresh and retry" };
			}
		}

		const deleted = await transaction
			.delete(userTable)
			.where(eq(userTable.id, targetId))
			.returning({ id: userTable.id });
		return deleted.length === 1 ? { success: true } : { success: false, error: "Manager not found" };
	});
}
