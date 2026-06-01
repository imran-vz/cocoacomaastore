import { describe, expect, it, vi } from "vitest";
import {
	addComboToCart,
	addDessertToCart,
	applyPosCartEvent,
	getCartLineView,
	getOrderCopyText,
	getUpiPaymentText,
	initialPosCartState,
	saveCartOrder,
	updateCartLineQuantity,
} from "./operations";
import type { CartComboInput, CartDessertInput, CartLine } from "./shapes";

const baseDessert: CartDessertInput = {
	id: 1,
	name: "brownie",
	price: 100,
	hasUnlimitedStock: false,
};

const cartLine: CartLine = {
	cartLineId: "line-1",
	baseDessertId: 1,
	baseDessertName: "brownie",
	baseDessertPrice: 100,
	hasUnlimitedStock: false,
	modifiers: [{ dessertId: 2, name: "ice cream", price: 50, quantity: 2 }],
	unitPrice: 200,
	quantity: 2,
};

const combo: CartComboInput = {
	id: 10,
	name: "brownie blast",
	baseDessertId: 1,
	overridePrice: null,
	baseDessert,
	items: [{ quantity: 2, dessert: { id: 2, name: "ice cream", price: 50 } }],
};

describe("POS cart behaviour", () => {
	it("applies cart events against the latest reducer state", () => {
		const first = applyPosCartEvent(initialPosCartState, {
			type: "add-dessert",
			dessert: baseDessert,
			inventoryByDessertId: { 1: 5 },
		});
		const second = applyPosCartEvent(first, {
			type: "add-dessert",
			dessert: baseDessert,
			inventoryByDessertId: { 1: 5 },
		});

		expect(second.cart).toHaveLength(1);
		expect(second.cart[0]?.quantity).toBe(2);
		expect(second.lastError).toBeNull();
	});

	it("adds Dessert lines and enforces inventory caps", () => {
		const added = addDessertToCart([], baseDessert, { 1: 1 });
		expect(added.ok).toBe(true);
		expect(added.cart).toHaveLength(1);
		expect(added.cart[0]?.baseDessertName).toBe("brownie");

		const blocked = addDessertToCart(added.cart, baseDessert, { 1: 1 });
		expect(blocked.ok).toBe(false);
		expect(blocked.cart[0]?.quantity).toBe(1);
	});

	it("adds Combo lines with computed modifier price", () => {
		const added = addComboToCart([], combo, { 1: 5 });
		expect(added.ok).toBe(true);
		expect(added.cart).toHaveLength(1);
		expect(added.cart[0]).toMatchObject({ comboId: 10, comboName: "brownie blast", unitPrice: 200 });
	});

	it("clamps quantity to remaining stock across lines", () => {
		const result = updateCartLineQuantity([cartLine], "line-1", 5, { 1: 3 });
		expect(result.ok).toBe(false);
		expect(result.cart[0]?.quantity).toBe(3);
	});

	it("builds shared Cart line, UPI, and copy text", () => {
		expect(getCartLineView(cartLine)).toMatchObject({
			displayName: "brownie",
			modifierText: "+ 2× ice cream",
			lineTotalText: "₹400",
		});
		expect(getUpiPaymentText(425, [cartLine], "store@upi")).toContain("upi://pay?pa=store@upi");
		expect(getOrderCopyText([cartLine], 425, 25)).toContain("Brownie (+ 2× ice cream) × 2 = ₹400.00");
	});

	it("saves Orders through the provided adapter", async () => {
		const adapter = vi.fn().mockResolvedValue(undefined);
		await expect(
			saveCartOrder(adapter, { cart: [cartLine], customerName: "  Ada  ", deliveryCost: 25 }),
		).resolves.toEqual({
			ok: true,
		});
		expect(adapter).toHaveBeenCalledWith({ customerName: "Ada", lines: [cartLine], deliveryCost: "25.00" });
	});
});
