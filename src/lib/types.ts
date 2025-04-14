export interface Dessert {
	id: number;
	name: string;
	description?: string | null;
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
	deliveryCost: string;
	total: string;
	createdAt: Date;
	items: CartItem[];
}
