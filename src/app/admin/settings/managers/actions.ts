"use server";

import { Effect } from "effect";
import { db } from "@/db";
import { type User, userTable } from "@/db/schema";
import { deleteManagerAccount } from "@/lib/admin-account-deletion";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth/guards";
import { sanitizeEmail } from "@/lib/sanitize";
import { type CreateManagerSchema, createManagerSchema, deleteManagerSchema } from "@/lib/validation";
import { CacheTag, updateNextCacheEffect } from "@/server/effect/cache-tags";
import { runNextAppEffect } from "@/server/effect/next-runtime";
import { Database } from "@/server/effect/services/db";

export type ManagerRow = Pick<User, "id" | "name" | "email" | "role"> & {
	createdAt: string;
};

export async function getCachedManagers(): Promise<ManagerRow[]> {
	await requireAdmin();
	const managers = await db
		.select({
			id: userTable.id,
			name: userTable.name,
			email: userTable.email,
			role: userTable.role,
			createdAt: userTable.createdAt,
		})
		.from(userTable)
		.orderBy(userTable.createdAt);

	return managers.map((manager) => ({
		...manager,
		createdAt: manager.createdAt.toISOString(),
	}));
}

export async function createManager(data: CreateManagerSchema) {
	await requireAdmin();

	// Validate and sanitize input
	const validated = createManagerSchema.parse(data);
	const sanitizedEmail = sanitizeEmail(validated.email);

	try {
		// Create user with admin plugin's createUser API
		await auth.api.createUser({
			body: {
				name: validated.name,
				email: sanitizedEmail,
				password: validated.password,
				role: validated.role,
			},
		});

		await runNextAppEffect(
			updateNextCacheEffect({
				tags: [CacheTag.managers],
				paths: ["/admin/settings/managers", "/admin/managers"],
			}),
		);
		return { success: true };
	} catch (error) {
		console.error("Error creating manager:", error);
		return { success: false, error: "Failed to create manager" };
	}
}

export async function deleteManager(id: string) {
	const actor = await requireAdmin();

	// Validate input
	const { id: validatedId } = deleteManagerSchema.parse({ id });

	try {
		return await runNextAppEffect(
			Effect.gen(function* () {
				const database = yield* Database;
				const result = yield* database.attempt("delete manager", (db) =>
					deleteManagerAccount(db, actor.id, validatedId),
				);
				if (!result.success) return result;
				yield* updateNextCacheEffect({
					tags: [CacheTag.managers],
					paths: ["/admin/settings/managers", "/admin/managers"],
				});
				return result;
			}),
		);
	} catch (error) {
		console.error("Error deleting manager:", error);
		return { success: false, error: "Failed to delete manager" };
	}
}
