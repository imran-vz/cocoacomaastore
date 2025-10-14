"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { accountTable, userTable } from "@/db/schema";

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
		// Generate a unique user ID
		const userId = crypto.randomUUID();

		// Hash the password
		const hashedPassword = await bcrypt.hash(data.password, 10);

		// Insert user
		await db.insert(userTable).values({
			id: userId,
			name: data.name,
			email: data.email,
			role: data.role,
			emailVerified: true,
		});

		// Insert account with password
		await db.insert(accountTable).values({
			id: crypto.randomUUID(),
			userId: userId,
			accountId: data.email,
			providerId: "credential",
			password: hashedPassword,
		});

		revalidatePath("/admin/managers");
		return { success: true };
	} catch (error) {
		console.error("Error creating manager:", error);
		return { success: false, error: "Failed to create manager" };
	}
}

export async function deleteManager(id: string) {
	try {
		// Delete associated accounts
		await db.delete(accountTable).where(eq(accountTable.userId, id));
		// Delete user
		await db.delete(userTable).where(eq(userTable.id, id));

		revalidatePath("/admin/managers");
		return { success: true };
	} catch (error) {
		console.error("Error deleting manager:", error);
		return { success: false, error: "Failed to delete manager" };
	}
}
