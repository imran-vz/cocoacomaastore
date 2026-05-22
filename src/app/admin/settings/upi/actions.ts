"use server";

import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { type UpiAccount, upiAccountsTable } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { sanitizeUpiId } from "@/lib/sanitize";
import { createUpiAccountSchema, deleteUpiAccountSchema, updateUpiAccountSchema } from "@/lib/validation";
import { updateNextCacheEffect } from "@/server/effect/cache-tags";
import { runNextAppEffect } from "@/server/effect/next-runtime";
import { Database } from "@/server/effect/services/db";

export type AdminUpiAccount = Omit<UpiAccount, "createdAt"> & {
	createdAt: string;
};

export async function getCachedAdminUpiAccounts(): Promise<AdminUpiAccount[]> {
	await requireAdmin();

	return runNextAppEffect(
		Effect.gen(function* () {
			const database = yield* Database;
			const accounts = yield* database.attempt("list admin UPI accounts", (db) =>
				db.query.upiAccountsTable.findMany({
					where: eq(upiAccountsTable.isDeleted, false),
					orderBy: (accounts, { asc }) => [asc(accounts.sequence)],
				}),
			);

			return accounts.map((account) => ({
				...account,
				createdAt: account.createdAt.toISOString(),
			}));
		}),
	);
}

export async function createUpiAccount(data: { label: string; upiId: string; enabled?: boolean }) {
	await requireAdmin();

	// Validate and sanitize input
	const validated = createUpiAccountSchema.parse(data);
	const sanitizedUpiId = sanitizeUpiId(validated.upiId);

	try {
		await runNextAppEffect(
			Effect.gen(function* () {
				const database = yield* Database;
				yield* database.attempt("create UPI account", (db) =>
					db.insert(upiAccountsTable).values({
						label: validated.label,
						upiId: sanitizedUpiId,
						enabled: validated.enabled,
						sequence: 0,
					}),
				);
				yield* updateNextCacheEffect({
					tags: ["upi-accounts", "upi-accounts-admin"],
					paths: ["/admin/settings/upi", "/admin/upi"],
				});
			}),
		);
		return { success: true };
	} catch (error) {
		console.error("Error creating UPI account:", error);
		return { success: false, error: "Failed to create UPI account" };
	}
}

export async function updateUpiAccount(id: UpiAccount["id"], data: Pick<UpiAccount, "label" | "upiId" | "enabled">) {
	await requireAdmin();

	// Validate and sanitize input
	const validated = updateUpiAccountSchema.parse({ id, data });
	const sanitizedUpiId = sanitizeUpiId(validated.data.upiId);

	try {
		await runNextAppEffect(
			Effect.gen(function* () {
				const database = yield* Database;
				yield* database.attempt("update UPI account", (db) =>
					db
						.update(upiAccountsTable)
						.set({
							label: validated.data.label,
							upiId: sanitizedUpiId,
							enabled: validated.data.enabled,
						})
						.where(eq(upiAccountsTable.id, validated.id)),
				);
				yield* updateNextCacheEffect({
					tags: ["upi-accounts", "upi-accounts-admin"],
					paths: ["/admin/settings/upi", "/admin/upi"],
				});
			}),
		);
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
		await runNextAppEffect(
			Effect.gen(function* () {
				const database = yield* Database;
				yield* database.attempt("delete UPI account", (db) =>
					db.update(upiAccountsTable).set({ isDeleted: true }).where(eq(upiAccountsTable.id, validatedId)),
				);
				yield* updateNextCacheEffect({
					tags: ["upi-accounts", "upi-accounts-admin"],
					paths: ["/admin/settings/upi", "/admin/upi"],
				});
			}),
		);
		return { success: true };
	} catch (error) {
		console.error("Error deleting UPI account:", error);
		return { success: false, error: "Failed to delete UPI account" };
	}
}
