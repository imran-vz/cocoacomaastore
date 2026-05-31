"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { createInventoryActions } from "./inventory-actions";

const actions = createInventoryActions({ label: "admin", requireUser: requireAdmin });

export async function upsertInventoryWithAudit(updates: Parameters<typeof actions.upsertInventoryWithAudit>[0]) {
	return actions.upsertInventoryWithAudit(updates);
}
