import { describe, expect, it, vi } from "vitest";
import {
	addComboToCart,
	addDessertToCart,
	applyPosCartEvent,
	completeAcknowledgedOrder,
	fingerprintOrderSubmission,
	getCartLineView,
	getOrderCopyText,
	getUpiPaymentText,
	initialPosCartState,
	resolveOrderSubmissionIdentity,
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

	it("accepts quantity 99 and rejects quantity 100 without changing the cart", () => {
		const accepted = updateCartLineQuantity([cartLine], "line-1", 99, { 1: 100 });
		expect(accepted.ok).toBe(true);
		expect(accepted.cart[0]?.quantity).toBe(99);

		const rejected = updateCartLineQuantity(accepted.cart, "line-1", 100, { 1: 100 });
		expect(rejected).toEqual({
			ok: false,
			cart: accepted.cart,
			error: "Quantity cannot be greater than 99",
		});
	});

	it("rejects adding a direct Dessert or Combo already at quantity 99", () => {
		const directLine: CartLine = { ...cartLine, modifiers: [], quantity: 99 };
		const comboLine: CartLine = {
			...cartLine,
			cartLineId: "combo-line",
			comboId: combo.id,
			comboName: combo.name,
			quantity: 99,
		};
		const cases = [
			() => addDessertToCart([directLine], baseDessert, { 1: 500 }),
			() => addComboToCart([comboLine], combo, { 1: 99 }),
		];

		for (const mutate of cases) {
			const result = mutate();
			expect(result.ok).toBe(false);
			if (result.ok) throw new Error("Expected the quantity limit to reject the cart mutation");
			expect(result.error).toBe("Quantity cannot be greater than 99");
			expect(result.cart[0]?.quantity).toBe(99);
		}
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

	it("saves only minimal direct and combo references through the provided adapter", async () => {
		const acknowledgement = { ok: true as const, orderId: 42, replayed: false, refreshWarning: false };
		const adapter = vi.fn().mockResolvedValue(acknowledgement);
		const comboLine: CartLine = { ...cartLine, cartLineId: "line-2", comboId: 10, comboName: "brownie blast" };
		await expect(
			saveCartOrder(adapter, {
				cart: [cartLine, comboLine],
				customerName: "  Ada  ",
				deliveryCost: 25,
				submissionId: "93d933ae-adf6-4aec-a024-200fba2e3cd5",
			}),
		).resolves.toEqual(acknowledgement);
		expect(adapter).toHaveBeenCalledWith({
			customerName: "Ada",
			lines: [
				{ baseDessertId: 1, quantity: 2 },
				{ baseDessertId: 1, comboId: 10, quantity: 2 },
			],
			deliveryCost: "25.00",
			submissionId: "93d933ae-adf6-4aec-a024-200fba2e3cd5",
		});
	});

	it("preserves a serialized submission conflict from the server action", async () => {
		const conflict = {
			ok: false as const,
			error: "This order submission was already used for different order details.",
		};

		await expect(
			saveCartOrder(vi.fn().mockResolvedValue(conflict), {
				cart: [cartLine],
				customerName: "Ada",
				deliveryCost: 0,
				submissionId: "93d933ae-adf6-4aec-a024-200fba2e3cd5",
			}),
		).resolves.toEqual(conflict);
	});

	it("reuses submission identity for the same normalized minimal request and rotates it after a semantic change", () => {
		const comboLine: CartLine = { ...cartLine, cartLineId: "line-2", comboId: 10, comboName: "brownie blast" };
		const firstInput = {
			cart: [cartLine, comboLine],
			customerName: " <b>Ada</b> ",
			deliveryCost: "25",
		};
		const first = resolveOrderSubmissionIdentity(null, firstInput, "first-id");
		const unchanged = resolveOrderSubmissionIdentity(
			first,
			{
				cart: [
					{ ...comboLine, cartLineId: "different-client-id", comboName: "renamed locally" },
					{ ...cartLine, baseDessertName: "renamed locally" },
				],
				customerName: "Ada",
				deliveryCost: 25,
			},
			"unused-id",
		);
		const changed = resolveOrderSubmissionIdentity(
			unchanged,
			{ ...firstInput, cart: [{ ...cartLine, quantity: 3 }, comboLine] },
			"changed-id",
		);

		expect(unchanged).toBe(first);
		expect(changed.submissionId).toBe("changed-id");
		expect(changed.clientFingerprint).not.toBe(first.clientFingerprint);
		expect(fingerprintOrderSubmission(firstInput)).toBe(first.clientFingerprint);
	});

	it("rotates submission identity after an explicit reset and preserves it after an adapter error", async () => {
		const input = { cart: [cartLine], customerName: "Ada", deliveryCost: 0 };
		const first = resolveOrderSubmissionIdentity(null, input, "first-id");
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

		await expect(
			saveCartOrder(vi.fn().mockRejectedValue(new Error("network unavailable")), {
				...input,
				submissionId: first.submissionId,
			}),
		).resolves.toEqual({ ok: false, error: "network unavailable" });
		const retry = resolveOrderSubmissionIdentity(first, input, "unused-id");
		const afterReset = resolveOrderSubmissionIdentity(null, input, "reset-id");

		expect(retry.submissionId).toBe("first-id");
		expect(afterReset.submissionId).toBe("reset-id");
		errorSpy.mockRestore();
	});

	it("clears and closes an acknowledged order before refresh and reports refresh failure as a warning", async () => {
		const events: string[] = [];
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const result = await completeAcknowledgedOrder({
			acknowledgement: { orderId: 42, replayed: false, refreshWarning: false },
			clearCart: () => events.push("clear"),
			closeCart: () => events.push("close"),
			refreshInventory: () => {
				events.push("refresh");
				throw new Error("refresh unavailable");
			},
		});

		expect(events).toEqual(["clear", "close", "refresh"]);
		expect(result).toEqual({ orderId: 42, replayed: false, refreshWarning: true });
		errorSpy.mockRestore();
	});
});
