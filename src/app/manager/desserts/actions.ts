"use server";

import { upsertInventoryWithAudit as upsertManagerInventoryWithAudit } from "@/lib/role-actions/manager-inventory";

type InventoryUpdate = Parameters<typeof upsertManagerInventoryWithAudit>[0];

export async function upsertInventoryWithAudit(updates: InventoryUpdate) {
	return upsertManagerInventoryWithAudit(updates);
}
