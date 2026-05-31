"use server";

import { requireManagerAccess } from "@/lib/auth/guards";
import { createInventoryActions } from "./inventory-actions";

const actions = createInventoryActions({ label: "manager", requireUser: requireManagerAccess });

export async function upsertInventoryWithAudit(updates: Parameters<typeof actions.upsertInventoryWithAudit>[0]) {
	return actions.upsertInventoryWithAudit(updates);
}
