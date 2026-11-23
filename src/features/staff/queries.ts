import "server-only";

import { asc } from "drizzle-orm";
import { db } from "@/db";
import { userTable } from "@/db/schema";
import { type Area, areaOf } from "@/features/access/area";
import { requireAdmin } from "@/features/access/session";

export type StaffAccount = { id: string; name: string; email: string; area: Area; createdAt: string };

/** Every staff account, oldest first. */
export async function listStaffAccounts(): Promise<StaffAccount[]> {
	await requireAdmin();
	const rows = await db
		.select({
			id: userTable.id,
			name: userTable.name,
			email: userTable.email,
			role: userTable.role,
			createdAt: userTable.createdAt,
		})
		.from(userTable)
		.orderBy(asc(userTable.createdAt));

	return rows.map(({ role, createdAt, ...account }) => ({
		...account,
		area: areaOf(role),
		createdAt: createdAt.toISOString(),
	}));
}
