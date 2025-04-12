export interface Dessert {
	id: number;
	name: string;
	description: string;
	price: number;
}

export interface CartItem extends Dessert {
	quantity: number;
}

export type OrderStatus = "pending" | "completed";

export interface Order {
	id: number;
	customerName: string;
	status: OrderStatus;
	createdAt: Date;
	items: CartItem[];
}
