import { bootstrapFirstAdmin, parseBootstrapAdminEnvironment } from "@/lib/bootstrap-admin";

async function main(): Promise<number> {
	try {
		const config = parseBootstrapAdminEnvironment(process.env);

		delete process.env.BOOTSTRAP_ADMIN_NAME;
		delete process.env.BOOTSTRAP_ADMIN_EMAIL;
		delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
		delete process.env.COCOACOMAA_BOOTSTRAP_ADMIN_ACKNOWLEDGE_SHARED_DATABASE;
		process.env.DB_QUERY_TIMING = "0";

		const [{ auth }, { db }, { and, eq }, { userTable }] = await Promise.all([
			import("@/lib/auth"),
			import("@/db"),
			import("drizzle-orm"),
			import("@/db/schema"),
		]);

		const status = await bootstrapFirstAdmin(config, {
			async findUserByEmail(email) {
				const [user] = await db
					.select({ id: userTable.id, role: userTable.role })
					.from(userTable)
					.where(eq(userTable.email, email))
					.limit(1);
				return user ?? null;
			},
			async findFirstAdmin() {
				const [user] = await db
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
				const updated = await db
					.update(userTable)
					.set({ role: "admin" })
					.where(and(eq(userTable.id, id), eq(userTable.email, email), eq(userTable.role, "user")))
					.returning({ id: userTable.id });
				return updated.length === 1;
			},
			async deleteCreatedUser(id) {
				const deleted = await db.delete(userTable).where(eq(userTable.id, id)).returning({ id: userTable.id });
				return deleted.length === 1;
			},
		});

		console.log(status === "created" ? "First administrator created." : "First administrator already exists.");
		return 0;
	} catch {
		console.error("First administrator bootstrap failed.");
		return 1;
	}
}

main().then((exitCode) => process.exit(exitCode));
