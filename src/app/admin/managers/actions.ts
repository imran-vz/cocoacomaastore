"use server";

import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { headers } from "next/headers";
import { db } from "@/db";
import { userTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth/guards";
import { sanitizeEmail } from "@/lib/sanitize";
import { type CreateManagerSchema, createManagerSchema, deleteManagerSchema } from "@/lib/validation";
import { updateNextCacheEffect } from "@/server/effect/cache-tags";
import { runNextAppEffect } from "@/server/effect/next-runtime";
import { Database } from "@/server/effect/services/db";

export async function getCachedManagers() {
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

	return managers;
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
			headers: await headers(),
		});

		await runNextAppEffect(
			updateNextCacheEffect({
				tags: ["managers"],
				paths: ["/admin/managers"],
			}),
		);
		return { success: true };
	} catch (error) {
		console.error("Error creating manager:", error);
		return { success: false, error: "Failed to create manager" };
	}
}

export async function deleteManager(id: string) {
	await requireAdmin();

	// Validate input
	const { id: validatedId } = deleteManagerSchema.parse({ id });

	try {
		await runNextAppEffect(
			Effect.gen(function* () {
				const database = yield* Database;
				yield* database.attempt("delete manager", (db) => db.delete(userTable).where(eq(userTable.id, validatedId)));
				yield* updateNextCacheEffect({
					tags: ["managers"],
					paths: ["/admin/managers"],
				});
			}),
		);
		return { success: true };
	} catch (error) {
		console.error("Error deleting manager:", error);
		return { success: false, error: "Failed to delete manager" };
	}
}
