export interface Dessert {
	id: number;
	name: string;
	description?: string | null;
	price: number;
	enabled: boolean;
	sequence: number;
}

export interface CartItem extends Dessert {
	quantity: number;
}
