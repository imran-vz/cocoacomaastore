"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/db";
import { type UpiAccount, upiAccountsTable } from "@/db/schema";

export async function createUpiAccount(data: {
	label: string;
	upiId: string;
	enabled?: boolean;
}) {
	try {
		await db.insert(upiAccountsTable).values({
			label: data.label,
			upiId: data.upiId,
			enabled: data.enabled ?? true,
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
	try {
		await db
			.update(upiAccountsTable)
			.set(data)
			.where(eq(upiAccountsTable.id, id));

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
	try {
		await db
			.update(upiAccountsTable)
			.set({ isDeleted: true })
			.where(eq(upiAccountsTable.id, id));

		revalidateTag("upi-accounts", "max");
		revalidateTag("upi-accounts-admin", "max");
		revalidatePath("/admin/upi");
		return { success: true };
	} catch (error) {
		console.error("Error deleting UPI account:", error);
		return { success: false, error: "Failed to delete UPI account" };
	}
}
