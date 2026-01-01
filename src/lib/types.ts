import type { Dessert as DBDessert } from "@/db/schema";

export type Dessert = DBDessert & {
	inventoryQuantity?: number;
};

export interface CartItem extends Dessert {
	quantity: number;
}
