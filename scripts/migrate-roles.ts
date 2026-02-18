/**
 * Migration script to recreate non-admin users with proper better-auth structure
 *
 * This script:
 * 1. Fetches all existing users with "manager" role from the database
 * 2. Deletes them (skips admin users)
 * 3. Recreates them using better-auth API with "user" role
 *
 * Note: Users will need to reset their passwords after migration
 * since we cannot retrieve the original passwords.
 *
 * Run with: bun run scripts/migrate-roles.ts
 */

import { eq, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { auth } from "../src/lib/auth";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not set");
}

const client = postgres(process.env.DATABASE_URL, { prepare: false });
const db = drizzle(client, { schema });

// Default password for recreated users - they MUST change this
const DEFAULT_PASSWORD = "Q!w2E#r4t5";

async function migrate() {
	console.log("🚀 Migrating non-admin users to new better-auth structure...\n");

	try {
		// Step 1: Fetch all existing users with "manager" role (skip admins)
		const usersToMigrate = await db
			.select({
				id: schema.userTable.id,
				name: schema.userTable.name,
				email: schema.userTable.email,
				role: schema.userTable.role,
			})
			.from(schema.userTable)
			.where(ne(schema.userTable.role, "admin"));

		if (usersToMigrate.length === 0) {
			console.log("✅ No users with 'manager' role found. Nothing to migrate.");
			await client.end();
			return;
		}

		console.log(`📋 Found ${usersToMigrate.length} user(s) to migrate:\n`);

		for (const user of usersToMigrate) {
			console.log(`  - ${user.name} (${user.email}) - manager → user`);
		}

		console.log("\n⚠️  Admin users will be skipped.\n");
		console.log("⚠️  Starting migration...\n");

		// Step 2: Delete sessions and accounts for users being migrated
		for (const user of usersToMigrate) {
			await db
				.delete(schema.sessionTable)
				.where(eq(schema.sessionTable.userId, user.id));
			await db
				.delete(schema.accountTable)
				.where(eq(schema.accountTable.userId, user.id));
			await db.delete(schema.userTable).where(eq(schema.userTable.id, user.id));
		}
		console.log("  ✓ Deleted manager users and their sessions/accounts");

		// Step 3: Recreate users using better-auth API
		console.log("\n📝 Recreating users with better-auth API...\n");

		const recreatedUsers: { name: string; email: string; role: string }[] = [];

		for (const user of usersToMigrate) {
			try {
				// Create user via better-auth API (defaults to "user" role)
				const result = await auth.api.signUpEmail({
					body: {
						name: user.name,
						email: user.email,
						password: DEFAULT_PASSWORD,
					},
				});

				if (result.user) {
					recreatedUsers.push({
						name: user.name,
						email: user.email,
						role: "user",
					});
					console.log(`  ✓ Created ${user.name} (${user.email}) as user`);
				}
			} catch (error) {
				console.error(
					`  ✗ Failed to create ${user.name} (${user.email}):`,
					error,
				);
			}
		}

		// Summary
		console.log(`\n${"=".repeat(50)}`);
		console.log("📊 Migration Summary");
		console.log("=".repeat(50));

		console.log(
			`\nSuccessfully migrated ${recreatedUsers.length}/${usersToMigrate.length} user(s):\n`,
		);

		for (const user of recreatedUsers) {
			console.log(`  - ${user.name} (${user.email}) - ${user.role}`);
		}

		console.log(`\n${"=".repeat(50)}`);
		console.log(
			"⚠️  IMPORTANT: Migrated users have been assigned a temporary password:",
		);
		console.log(`   Password: ${DEFAULT_PASSWORD}`);
		console.log("   Users MUST change their password after logging in!");
		console.log("=".repeat(50));

		console.log("\n✅ Migration completed successfully!");
	} catch (error) {
		console.error("\n❌ Migration failed:", error);
		process.exit(1);
	} finally {
		await client.end();
	}
}

migrate();
