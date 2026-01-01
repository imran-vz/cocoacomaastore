import type { Dessert } from "@/db/schema";

export interface CartItem extends Dessert {
	quantity: number;
}
