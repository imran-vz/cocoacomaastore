export interface Dessert {
	id: number;
	name: string;
	description: string;
	price: number;
}

export interface CartItem extends Dessert {
	quantity: number;
}
