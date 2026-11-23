"use server";

import { staffAction } from "@/features/access/action";
import { type StockSaveResult, setStockWithAudit } from "@/features/inventory/daily-inventory";
import { type StockUpdate, stockUpdatesSchema } from "@/features/inventory/schemas";
import { stockChangeTags } from "@/features/inventory/tags";
import { dayKeyOf } from "@/lib/shop-calendar";
import { writeAndRefresh } from "@/server/effect/write-and-refresh";

/** Sets today's counts. A `conflict` result means nothing was written. */
export const saveTodayStock = staffAction(async (user, updates: StockUpdate[]) => {
	const validated = stockUpdatesSchema.parse(updates);
	const dayKey = dayKeyOf();
	return writeAndRefresh(
		"set daily inventory with audit",
		(saved: StockSaveResult) => (saved.status === "saved" ? stockChangeTags(dayKey) : []),
		(db) => setStockWithAudit(db, { dayKey, updates: validated, userId: user.id }),
	);
});
