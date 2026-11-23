import { eq, sql } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import { userTable } from "@/db/schema";
import { areaOf, roleOf } from "@/features/access/area";
import type { BootstrapAdminDependencies } from "@/features/staff/bootstrap/bootstrap";
import { createStaffUser } from "@/features/staff/create-staff-user";

const FIRST_ADMIN_LOCK_NAMESPACE = 1_129_273_921;
const FIRST_ADMIN_LOCK_KEY = 1_096_042_701;

/**
 * Holds a transaction-scoped advisory lock while the bootstrap runs. Better Auth creates the user
 * on its own connection, which commits before the lock is released, so a waiting attempt sees it.
 */
export function createBootstrapAdminDependencies(db: AppDatabase): BootstrapAdminDependencies {
	return {
		withFirstAdminLock: (run) =>
			db.transaction(async (tx) => {
				await tx.execute(sql`SELECT pg_advisory_xact_lock(${FIRST_ADMIN_LOCK_NAMESPACE}, ${FIRST_ADMIN_LOCK_KEY})`);
				return run({
					async findUserByEmail(email) {
						const [user] = await tx
							.select({ role: userTable.role })
							.from(userTable)
							.where(eq(userTable.email, email))
							.limit(1);
						return user ? { area: areaOf(user.role) } : null;
					},
					async findFirstAdmin() {
						const [user] = await tx
							.select({ id: userTable.id })
							.from(userTable)
							.where(eq(userTable.role, roleOf("admin")))
							.limit(1);
						return user ?? null;
					},
					createAdmin: (config) => createStaffUser({ ...config, area: "admin" }),
				});
			}),
	};
}
