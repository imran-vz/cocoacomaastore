import { describe, expect, it } from "vitest";
import {
	type CartEvent,
	type CartState,
	cartReducer,
	emptyCart,
	orderRequestLines,
	remainingStock,
	type SellableCombo,
	type SellableDessert,
	type StockCounts,
} from "@/features/pos/cart";

const brownie: SellableDessert = { id: 1, name: "brownie", price: 100, hasUnlimitedStock: false };
const cookie: SellableDessert = { id: 2, name: "cookie", price: 40, hasUnlimitedStock: true };
const blast: SellableCombo = {
	id: 10,
	name: "brownie blast",
	baseDessertId: 1,
	overridePrice: null,
	baseDessert: { price: 100, hasUnlimitedStock: false },
	items: [{ quantity: 2, dessert: { price: 50 } }],
};

function stockOf(entries: Record<number, number>): StockCounts {
	return new Map(Object.entries(entries).map(([id, quantity]) => [Number(id), quantity]));
}

function apply(events: CartEvent[], state: CartState = emptyCart): CartState {
	return events.reduce(cartReducer, state);
}

describe("POS cart", () => {
	it("adds a dessert once per tile and counts repeat taps on the same line", () => {
		const stock = stockOf({ 1: 5 });
		const state = apply([
			{ type: "add-dessert", dessert: brownie, stock },
			{ type: "add-dessert", dessert: brownie, stock },
		]);

		expect(state.lines).toMatchObject([{ baseDessertId: 1, name: "brownie", unitPrice: 100, quantity: 2 }]);
		expect(state.rejection).toBeNull();
	});

	it("refuses an add beyond today's stock, naming the tile and leaving the cart as it was", () => {
		const stock = stockOf({ 1: 1 });
		const once = apply([{ type: "add-dessert", dessert: brownie, stock }]);
		const twice = cartReducer(once, { type: "add-dessert", dessert: brownie, stock });

		expect(twice.lines).toEqual(once.lines);
		expect(twice.rejection).toEqual({ id: 1, message: "Only 1 left", tile: "dessert:1" });
	});

	it("refuses a dessert with no stock today", () => {
		const state = apply([{ type: "add-dessert", dessert: brownie, stock: stockOf({}) }]);

		expect(state.lines).toEqual([]);
		expect(state.rejection?.message).toBe("Out of stock — set today's inventory");
	});

	it("counts a combo against its base dessert's stock", () => {
		const stock = stockOf({ 1: 2 });
		const state = apply([
			{ type: "add-combo", combo: blast, stock },
			{ type: "add-dessert", dessert: brownie, stock },
			{ type: "add-dessert", dessert: brownie, stock },
		]);

		expect(state.lines.map((line) => line.quantity)).toEqual([1, 1]);
		expect(state.rejection?.tile).toBe("dessert:1");
		expect(remainingStock(state.lines, brownie, stock)).toBe(0);
	});

	it("never limits a dessert with unlimited stock", () => {
		const state = apply([{ type: "add-dessert", dessert: cookie, stock: stockOf({}) }]);

		expect(state.lines).toHaveLength(1);
		expect(remainingStock(state.lines, cookie, stockOf({}))).toBe(Number.POSITIVE_INFINITY);
	});

	it("prices a combo from its add-ons unless it has an override price", () => {
		const stock = stockOf({ 1: 5 });
		const additive = apply([{ type: "add-combo", combo: blast, stock }]);
		const overridden = apply([{ type: "add-combo", combo: { ...blast, overridePrice: 180 }, stock }]);

		expect(additive.lines[0]).toMatchObject({ comboId: 10, name: "brownie blast", unitPrice: 200 });
		expect(overridden.lines[0]?.unitPrice).toBe(180);
	});

	it("steps a line up to 99 and refuses the 100th", () => {
		const stock = stockOf({ 2: 0 });
		const added = apply([{ type: "add-dessert", dessert: cookie, stock }]);
		const cartLineId = added.lines[0]?.cartLineId ?? "";
		const atLimit = apply(
			Array.from({ length: 98 }, () => ({ type: "step-line", cartLineId, delta: 1, stock }) as const),
			added,
		);
		const beyond = cartReducer(atLimit, { type: "step-line", cartLineId, delta: 1, stock });

		expect(atLimit.lines[0]?.quantity).toBe(99);
		expect(atLimit.rejection).toBeNull();
		expect(beyond.lines).toEqual(atLimit.lines);
		expect(beyond.rejection?.message).toBe("Quantity cannot be greater than 99");
	});

	it("removes a line stepped below one", () => {
		const stock = stockOf({ 1: 5 });
		const added = apply([{ type: "add-dessert", dessert: brownie, stock }]);
		const stepped = cartReducer(added, {
			type: "step-line",
			cartLineId: added.lines[0]?.cartLineId ?? "",
			delta: -1,
			stock,
		});

		expect(stepped.lines).toEqual([]);
	});

	it("starts a new order after clearing, emptying or saving the cart", () => {
		const stock = stockOf({ 1: 5 });
		const populated = apply([{ type: "add-dessert", dessert: brownie, stock }]);
		const [line] = populated.lines;
		if (!line) throw new Error("Expected a line");

		expect(cartReducer(populated, { type: "clear" }).intentVersion).toBe(1);
		expect(cartReducer(populated, { type: "remove-line", cartLineId: line.cartLineId }).intentVersion).toBe(1);
		expect(cartReducer(populated, { type: "acknowledge-save", savedLines: [line] }).intentVersion).toBe(1);
		expect(cartReducer(populated, { type: "add-dessert", dessert: brownie, stock }).intentVersion).toBe(0);
	});

	it("counts cashier edits but not saves as changes to the cart", () => {
		const stock = stockOf({ 1: 5 });
		const populated = apply([{ type: "add-dessert", dessert: brownie, stock }]);

		expect(populated.version).toBe(1);
		expect(cartReducer(populated, { type: "acknowledge-save", savedLines: populated.lines }).version).toBe(1);
	});

	it("takes off only what a save covered, keeping lines and units added while it was in flight", () => {
		const stock = stockOf({ 1: 5 });
		const sent = apply([{ type: "add-dessert", dessert: brownie, stock }]);
		const edited = apply(
			[
				{ type: "add-dessert", dessert: brownie, stock },
				{ type: "add-dessert", dessert: cookie, stock },
			],
			sent,
		);
		const acknowledged = cartReducer(edited, { type: "acknowledge-save", savedLines: sent.lines });

		expect(acknowledged.lines.map(({ name, quantity }) => ({ name, quantity }))).toEqual([
			{ name: "brownie", quantity: 1 },
			{ name: "cookie", quantity: 1 },
		]);
	});

	it("keeps a line re-added after the saved one was removed", () => {
		const stock = stockOf({ 1: 5 });
		const sent = apply([{ type: "add-dessert", dessert: brownie, stock }]);
		const readded = apply(
			[
				{ type: "remove-line", cartLineId: sent.lines[0]?.cartLineId ?? "" },
				{ type: "add-dessert", dessert: brownie, stock },
			],
			sent,
		);

		expect(cartReducer(readded, { type: "acknowledge-save", savedLines: sent.lines }).lines).toEqual(readded.lines);
	});

	it("orders desserts by reference and combos by reference with their base", () => {
		const stock = stockOf({ 1: 5 });
		const state = apply([
			{ type: "add-dessert", dessert: cookie, stock },
			{ type: "add-combo", combo: blast, stock },
		]);

		expect(orderRequestLines(state.lines)).toEqual([
			{ baseDessertId: 2, quantity: 1 },
			{ baseDessertId: 1, comboId: 10, quantity: 1 },
		]);
	});
});
