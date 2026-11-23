import type { inventoryAuditLogTable } from "@/db/schema";
import type { DayKey } from "@/lib/shop-calendar";

/** One shop day's stored counts. Desserts without a row have no stock that day. */
export type DayInventory = { dayKey: DayKey; rows: { dessertId: number; quantity: number }[] };

export type CountableDessert = { id: number; enabled: boolean; hasUnlimitedStock: boolean };

/** Only desserts on sale with limited stock are counted. */
export function isCounted(dessert: CountableDessert): boolean {
	return dessert.enabled && !dessert.hasUnlimitedStock;
}

/** A listed dessert with its count on one shop day (0 without a row). */
export type DessertStock = CountableDessert & { name: string; currentStock: number };

export type StockChangeAction = (typeof inventoryAuditLogTable.$inferSelect)["action"];

export type StockChange = {
	id: number;
	action: StockChangeAction;
	previousQuantity: number;
	newQuantity: number;
	orderId: number | null;
	createdAt: string;
	note: string | null;
	dessertName: string;
};

/** The latest changes to a day's stock (at most the limit read), and how many it has in all. */
export type StockChanges = { entries: StockChange[]; total: number };
