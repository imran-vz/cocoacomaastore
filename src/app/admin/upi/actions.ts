"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { type UpiAccount, upiAccountsTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { sanitizeUpiId } from "@/lib/sanitize";
import {
	createUpiAccountSchema,
	deleteUpiAccountSchema,
	updateUpiAccountSchema,
} from "@/lib/validation";

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

export async function createUpiAccount(data: {
	label: string;
	upiId: string;
	enabled?: boolean;
}) {
	await requireAdmin();

	// Validate and sanitize input
	const validated = createUpiAccountSchema.parse(data);
	const sanitizedUpiId = sanitizeUpiId(validated.upiId);

	try {
		await db.insert(upiAccountsTable).values({
			label: validated.label,
			upiId: sanitizedUpiId,
			enabled: validated.enabled,
			sequence: 0,
		});

		revalidateTag("upi-accounts", "max");
		revalidateTag("upi-accounts-admin", "max");
		revalidatePath("/admin/upi");
		return { success: true };
	} catch (error) {
		console.error("Error creating UPI account:", error);
		return { success: false, error: "Failed to create UPI account" };
	}
}

export async function updateUpiAccount(
	id: UpiAccount["id"],
	data: Pick<UpiAccount, "label" | "upiId" | "enabled">,
) {
	await requireAdmin();

	// Validate and sanitize input
	const validated = updateUpiAccountSchema.parse({ id, data });
	const sanitizedUpiId = sanitizeUpiId(validated.data.upiId);

	try {
		await db
			.update(upiAccountsTable)
			.set({
				label: validated.data.label,
				upiId: sanitizedUpiId,
				enabled: validated.data.enabled,
			})
			.where(eq(upiAccountsTable.id, validated.id));

		revalidateTag("upi-accounts", "max");
		revalidateTag("upi-accounts-admin", "max");
		revalidatePath("/admin/upi");
		return { success: true };
	} catch (error) {
		console.error("Error updating UPI account:", error);
		return { success: false, error: "Failed to update UPI account" };
	}
}

export async function deleteUpiAccount(id: UpiAccount["id"]) {
	await requireAdmin();

	// Validate input
	const { id: validatedId } = deleteUpiAccountSchema.parse({ id });

	try {
		await db
			.update(upiAccountsTable)
			.set({ isDeleted: true })
			.where(eq(upiAccountsTable.id, validatedId));

		revalidateTag("upi-accounts", "max");
		revalidateTag("upi-accounts-admin", "max");
		revalidatePath("/admin/upi");
		return { success: true };
	} catch (error) {
		console.error("Error deleting UPI account:", error);
		return { success: false, error: "Failed to delete UPI account" };
	}
}
