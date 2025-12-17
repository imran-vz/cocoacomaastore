"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/db";
import { userTable } from "@/db/schema";
import { auth } from "@/lib/auth";

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
	try {
		await auth.api.signUpEmail({
			body: {
				name: data.name,
				email: data.email,
				password: data.password,
				role: data.role,
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
	try {
		// Delete user (cascade deletes sessions and accounts)
		await db.delete(userTable).where(eq(userTable.id, id));

		revalidateTag("managers", "max");
		revalidatePath("/admin/managers");
		return { success: true };
	} catch (error) {
		console.error("Error deleting manager:", error);
		return { success: false, error: "Failed to delete manager" };
	}
}
