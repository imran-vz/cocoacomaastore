import { and, eq, sql } from "drizzle-orm";
import { userTable } from "@/db/schema";
import type { BootstrapAdminDependencies } from "@/lib/bootstrap-admin";

type AppDatabase = typeof import("@/db").db;
type AppAuth = typeof import("@/lib/auth").auth;

const FIRST_ADMIN_LOCK_NAMESPACE = 1_129_273_921;
const FIRST_ADMIN_LOCK_KEY = 1_096_042_701;

// Consumed via dynamic import() from scripts/seed-admin.ts and the integration tests.
// fallow-ignore-next-line unused-export
export function createBootstrapAdminDependencies(db: AppDatabase, auth: AppAuth): BootstrapAdminDependencies {
	return {
		withFirstAdminLock: (run) =>
			db.transaction(async (tx) => {
				await tx.execute(sql`SELECT pg_advisory_xact_lock(${FIRST_ADMIN_LOCK_NAMESPACE}, ${FIRST_ADMIN_LOCK_KEY})`);
				return run({
					async findUserByEmail(email) {
						const [user] = await tx
							.select({ id: userTable.id, role: userTable.role })
							.from(userTable)
							.where(eq(userTable.email, email))
							.limit(1);
						return user ?? null;
					},
					async findFirstAdmin() {
						const [user] = await tx
							.select({ id: userTable.id })
							.from(userTable)
							.where(eq(userTable.role, "admin"))
							.limit(1);
						return user ?? null;
					},
					async createCredentialUser(input) {
						const result = await auth.api.createUser({ body: input });
						return { id: result.user.id };
					},
					async promoteCreatedUser({ id, email }) {
						const updated = await tx
							.update(userTable)
							.set({ role: "admin" })
							.where(and(eq(userTable.id, id), eq(userTable.email, email), eq(userTable.role, "user")))
							.returning({ id: userTable.id });
						return updated.length === 1;
					},
					async deleteCreatedUser(id) {
						const deleted = await tx.delete(userTable).where(eq(userTable.id, id)).returning({ id: userTable.id });
						return deleted.length === 1;
					},
				});
			}),
	};
}
