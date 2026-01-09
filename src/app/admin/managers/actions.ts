"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { userTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { sanitizeEmail } from "@/lib/sanitize";
import { createManagerSchema, deleteManagerSchema } from "@/lib/validation";

async function requireAdmin() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.session || !session?.user) {
		throw new Error("Unauthorized");
	}
	if (session.user.role !== "admin") {
		throw new Error("Forbidden: Admin access required");
	}
	return session.user;
}

export async function getManagers() {
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

export async function createManager(data: {
	name: string;
	email: string;
	password: string;
	role: "admin" | "manager";
}) {
	await requireAdmin();

	// Validate and sanitize input
	const validated = createManagerSchema.parse(data);
	const sanitizedEmail = sanitizeEmail(validated.email);

	try {
		await auth.api.signUpEmail({
			body: {
				name: validated.name,
				email: sanitizedEmail,
				password: validated.password,
				role: validated.role,
			},
		});

		revalidateTag("managers", "max");
		revalidatePath("/admin/managers");
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
		// Delete user (cascade deletes sessions and accounts)
		await db.delete(userTable).where(eq(userTable.id, validatedId));

		revalidateTag("managers", "max");
		revalidatePath("/admin/managers");
		return { success: true };
	} catch (error) {
		console.error("Error deleting manager:", error);
		return { success: false, error: "Failed to delete manager" };
	}
}
