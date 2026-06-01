"use server";

import { upsertInventoryWithAudit as upsertAdminInventoryWithAudit } from "@/lib/role-actions/admin-inventory";

type InventoryUpdate = Parameters<typeof upsertAdminInventoryWithAudit>[0];

export async function upsertInventoryWithAudit(updates: InventoryUpdate) {
	return upsertAdminInventoryWithAudit(updates);
}
