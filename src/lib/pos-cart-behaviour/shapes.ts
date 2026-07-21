import type { OrderInvoiceModel } from "@/lib/order-invoice-model";
import type { CartLine, OrderRequestLine } from "@/lib/types";

export type InventoryByDessertId = Record<number, number>;

export type CartDessertInput = {
	id: number;
	name: string;
	price: number;
	hasUnlimitedStock: boolean;
};

export type CartComboInput = {
	id: number;
	name: string;
	baseDessertId: number;
	overridePrice: number | null;
	baseDessert: CartDessertInput;
	items: Array<{
		quantity: number;
		dessert: {
			id: number;
			name: string;
			price: number;
		};
	}>;
};

export type CartMutationResult = { ok: true; cart: CartLine[] } | { ok: false; cart: CartLine[]; error: string };

export type PosCartState = {
	cart: CartLine[];
	intentVersion: number;
	lastError: { id: number; message: string } | null;
};

export type PosCartEvent =
	| { type: "add-dessert"; dessert: CartDessertInput; inventoryByDessertId: InventoryByDessertId }
	| { type: "add-combo"; combo: CartComboInput; inventoryByDessertId: InventoryByDessertId }
	| { type: "remove-line"; cartLineId: string }
	| { type: "update-quantity"; cartLineId: string; quantity: number; inventoryByDessertId: InventoryByDessertId }
	| { type: "acknowledge-submission"; submittedCart: CartLine[] }
	| { type: "clear" };

export type SaveOrderInput = {
	cart: CartLine[];
	customerName: string;
	deliveryCost: string | number;
	submissionId: string;
};

export type OrderSubmissionInput = Omit<SaveOrderInput, "submissionId"> & {
	intentVersion: number;
};

export type SubmittedOrderSnapshot = OrderSubmissionInput;

export type OrderSubmissionIdentity = {
	clientFingerprint: string;
	intentVersion: number;
	submissionId: string;
};

export type OrderSaveAcknowledgement = {
	orderId: number;
	receipt: OrderInvoiceModel;
	replayed: boolean;
	refreshWarning: boolean;
};

export type SaveOrderResult = ({ ok: true } & OrderSaveAcknowledgement) | { ok: false; error: string };

export type SaveOrderAdapter = (input: {
	customerName: string;
	lines: OrderRequestLine[];
	deliveryCost: string;
	submissionId: string;
}) => Promise<SaveOrderResult>;

export type CompleteAcknowledgedOrderInput = {
	acknowledgement: OrderSaveAcknowledgement;
	acknowledgeSubmittedOrder: () => void;
	refreshInventory: () => void | Promise<void>;
};

export type CartLineView = {
	displayName: string;
	capitalizedDisplayName: string;
	hasModifiers: boolean;
	modifierText: string;
	copyModifierText: string;
	unitPriceText: string;
	lineTotalText: string;
};

export type { CartLine };
