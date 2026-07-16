import type {
	CartComboInput,
	CartDessertInput,
	CartLine,
	CartLineView,
	CartMutationResult,
	InventoryByDessertId,
	PosCartEvent,
	PosCartState,
	SaveOrderAdapter,
	SaveOrderInput,
	SaveOrderResult,
} from "./shapes";

const MAX_CART_LINE_QUANTITY = 199;
const OUT_OF_STOCK_MESSAGE = "Out of stock — set today's inventory";

function generateCartLineId(): string {
	return `cl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function capitalizeCartText(str: string) {
	return str
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

export function getCartInventoryUsage(cart: CartLine[]): Map<number, number> {
	const usage = new Map<number, number>();
	for (const line of cart) {
		const current = usage.get(line.baseDessertId) ?? 0;
		usage.set(line.baseDessertId, current + line.quantity);
	}
	return usage;
}

function getAvailableStock(dessertId: number, hasUnlimitedStock: boolean, inventoryByDessertId: InventoryByDessertId) {
	return hasUnlimitedStock ? Number.POSITIVE_INFINITY : (inventoryByDessertId[dessertId] ?? 0);
}

function incrementExistingLine(cart: CartLine[], cartLineId: string): CartLine[] {
	return cart.map((line) =>
		line.cartLineId === cartLineId && line.quantity < MAX_CART_LINE_QUANTITY
			? { ...line, quantity: line.quantity + 1 }
			: line,
	);
}

export function addDessertToCart(
	cart: CartLine[],
	dessert: CartDessertInput,
	inventoryByDessertId: InventoryByDessertId,
): CartMutationResult {
	const available = getAvailableStock(dessert.id, dessert.hasUnlimitedStock, inventoryByDessertId);
	const usedInCart = getCartInventoryUsage(cart).get(dessert.id) ?? 0;
	const remaining = available - usedInCart;

	if (remaining <= 0) return { ok: false, cart, error: OUT_OF_STOCK_MESSAGE };

	const existingLine = cart.find((line) => line.baseDessertId === dessert.id && line.modifiers.length === 0);
	if (existingLine) {
		if (existingLine.quantity >= available) return { ok: false, cart, error: `Only ${available} left` };
		return { ok: true, cart: incrementExistingLine(cart, existingLine.cartLineId) };
	}

	return {
		ok: true,
		cart: [
			...cart,
			{
				cartLineId: generateCartLineId(),
				baseDessertId: dessert.id,
				baseDessertName: dessert.name,
				baseDessertPrice: dessert.price,
				hasUnlimitedStock: dessert.hasUnlimitedStock,
				modifiers: [],
				unitPrice: dessert.price,
				quantity: 1,
			},
		],
	};
}

export function addComboToCart(
	cart: CartLine[],
	combo: CartComboInput,
	inventoryByDessertId: InventoryByDessertId,
): CartMutationResult {
	const available = getAvailableStock(combo.baseDessertId, combo.baseDessert.hasUnlimitedStock, inventoryByDessertId);
	const usedInCart = getCartInventoryUsage(cart).get(combo.baseDessertId) ?? 0;
	const remaining = available - usedInCart;

	if (remaining <= 0) return { ok: false, cart, error: OUT_OF_STOCK_MESSAGE };

	const existingLine = cart.find((line) => line.comboId === combo.id);
	if (existingLine) {
		if (existingLine.quantity >= available) return { ok: false, cart, error: `Only ${available} left` };
		return { ok: true, cart: incrementExistingLine(cart, existingLine.cartLineId) };
	}

	const modifiers = combo.items.map((item) => ({
		dessertId: item.dessert.id,
		name: item.dessert.name,
		price: item.dessert.price,
		quantity: item.quantity,
	}));
	const modifierTotal = modifiers.reduce((sum, mod) => sum + mod.price * mod.quantity, 0);
	const unitPrice = combo.overridePrice ?? combo.baseDessert.price + modifierTotal;

	return {
		ok: true,
		cart: [
			...cart,
			{
				cartLineId: generateCartLineId(),
				baseDessertId: combo.baseDessertId,
				baseDessertName: combo.baseDessert.name,
				baseDessertPrice: combo.baseDessert.price,
				hasUnlimitedStock: combo.baseDessert.hasUnlimitedStock,
				modifiers,
				unitPrice,
				quantity: 1,
				comboId: combo.id,
				comboName: combo.name,
			},
		],
	};
}

export function removeCartLine(cart: CartLine[], cartLineId: string): CartLine[] {
	return cart.filter((line) => line.cartLineId !== cartLineId);
}

export function updateCartLineQuantity(
	cart: CartLine[],
	cartLineId: string,
	quantity: number,
	inventoryByDessertId: InventoryByDessertId,
): CartMutationResult {
	if (quantity <= 0) return { ok: true, cart: removeCartLine(cart, cartLineId) };

	const line = cart.find((item) => item.cartLineId === cartLineId);
	if (!line) return { ok: true, cart };

	const available = getAvailableStock(line.baseDessertId, line.hasUnlimitedStock, inventoryByDessertId);
	const usedByOthers = cart
		.filter((item) => item.baseDessertId === line.baseDessertId && item.cartLineId !== cartLineId)
		.reduce((sum, item) => sum + item.quantity, 0);
	const maxAllowed = available - usedByOthers;

	if (maxAllowed <= 0) return { ok: false, cart: removeCartLine(cart, cartLineId), error: OUT_OF_STOCK_MESSAGE };
	if (quantity > maxAllowed) {
		return {
			ok: false,
			cart: cart.map((item) => (item.cartLineId === cartLineId ? { ...item, quantity: maxAllowed } : item)),
			error: `Only ${maxAllowed} available`,
		};
	}
	if (quantity > MAX_CART_LINE_QUANTITY) return { ok: false, cart, error: "Quantity cannot be greater than 199" };

	return {
		ok: true,
		cart: cart.map((item) => (item.cartLineId === cartLineId ? { ...item, quantity } : item)),
	};
}

export const initialPosCartState: PosCartState = { cart: [], lastError: null };

function withResult(state: PosCartState, result: CartMutationResult): PosCartState {
	return {
		cart: result.cart,
		lastError: result.ok ? state.lastError : { id: (state.lastError?.id ?? 0) + 1, message: result.error },
	};
}

export function applyPosCartEvent(state: PosCartState, event: PosCartEvent): PosCartState {
	switch (event.type) {
		case "add-dessert":
			return withResult(state, addDessertToCart(state.cart, event.dessert, event.inventoryByDessertId));
		case "add-combo":
			return withResult(state, addComboToCart(state.cart, event.combo, event.inventoryByDessertId));
		case "remove-line":
			return { ...state, cart: removeCartLine(state.cart, event.cartLineId) };
		case "update-quantity":
			return withResult(
				state,
				updateCartLineQuantity(state.cart, event.cartLineId, event.quantity, event.inventoryByDessertId),
			);
		case "clear":
			return { ...state, cart: [] };
	}
}

export function getCartLineView(line: CartLine): CartLineView {
	const displayName = line.comboName ?? line.baseDessertName;
	const hasModifiers = line.modifiers.length > 0 && !line.comboName;
	const modifierList = line.modifiers.map((modifier) =>
		modifier.quantity > 1 ? `${modifier.quantity}× ${modifier.name}` : modifier.name,
	);
	return {
		displayName,
		capitalizedDisplayName: capitalizeCartText(displayName.trim()),
		hasModifiers,
		modifierText: hasModifiers ? `+ ${modifierList.join(", ")}` : "",
		copyModifierText: hasModifiers ? ` (+ ${modifierList.join(", ")})` : "",
		unitPriceText: `₹${line.unitPrice} × ${line.quantity}`,
		lineTotalText: `₹${(line.unitPrice * line.quantity).toFixed(0)}`,
	};
}

export function getUpiPaymentText(total: number, lines: CartLine[], upiId: string): string {
	const transactionNote = `${lines
		.map((line) => line.comboName ?? line.baseDessertName)
		.join(", ")
		.slice(0, 60)}...`;
	const params = new URLSearchParams();
	params.set("am", total.toString());
	params.set("pn", "Cocoa Comaa");
	params.set("tn", transactionNote);
	return `upi://pay?pa=${upiId}&${params.toString()}`;
}

export function getOrderCopyText(cart: CartLine[], total: number, deliveryCost: number): string {
	const orderItemsText = cart
		.map((line) => {
			const view = getCartLineView(line);
			return `${view.capitalizedDisplayName}${view.copyModifierText} × ${line.quantity} = ₹${(line.unitPrice * line.quantity).toFixed(2)}`;
		})
		.join("\n");
	const deliveryLine = deliveryCost > 0 ? `\nDelivery: ₹${deliveryCost.toFixed(2)}` : "";
	return `${orderItemsText}${deliveryLine}\n------\nTotal: ₹${total.toFixed(2)}`;
}

export async function saveCartOrder(adapter: SaveOrderAdapter, input: SaveOrderInput): Promise<SaveOrderResult> {
	if (input.cart.length === 0) return { ok: false, error: "Cart is empty" };
	try {
		await adapter({
			customerName: input.customerName.trim(),
			lines: input.cart.map((line) =>
				line.comboId === undefined
					? { baseDessertId: line.baseDessertId, quantity: line.quantity }
					: { baseDessertId: line.baseDessertId, comboId: line.comboId, quantity: line.quantity },
			),
			deliveryCost: typeof input.deliveryCost === "number" ? input.deliveryCost.toFixed(2) : input.deliveryCost || "0",
		});
		return { ok: true };
	} catch (err) {
		console.error("Failed to create order:", err);
		return { ok: false, error: err instanceof Error ? err.message : "Failed to save order" };
	}
}
