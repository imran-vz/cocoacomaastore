import { describe, expect, it } from "vitest";
import { moveInSellOrder, sequencesFor } from "@/features/catalog/dessert-order";

// a, c, e are on sale; B and D are hidden.
const catalog = [
	{ id: 1, name: "a", enabled: true },
	{ id: 2, name: "B", enabled: false },
	{ id: 3, name: "c", enabled: true },
	{ id: 4, name: "D", enabled: false },
	{ id: 5, name: "e", enabled: true },
];
const names = (order: typeof catalog | null) => order?.map(({ name }) => name).join("");

describe("moving a dessert in the Sell-screen order", () => {
	it("swaps with the neighbouring dessert on sale, leaving hidden ones where they are", () => {
		expect(names(moveInSellOrder(catalog, 3, "up"))).toBe("cBaDe");
		expect(names(moveInSellOrder(catalog, 3, "down"))).toBe("aBeDc");
	});

	it("moves to just before the first, or just after the last, dessert on sale", () => {
		expect(names(moveInSellOrder(catalog, 5, "top"))).toBe("eaBcD");
		expect(names(moveInSellOrder(catalog, 1, "bottom"))).toBe("BcDea");
	});

	it("leaves the order alone at either end", () => {
		expect(names(moveInSellOrder(catalog, 1, "up"))).toBe("aBcDe");
		expect(names(moveInSellOrder(catalog, 1, "top"))).toBe("aBcDe");
		expect(names(moveInSellOrder(catalog, 5, "down"))).toBe("aBcDe");
		expect(names(moveInSellOrder(catalog, 5, "bottom"))).toBe("aBcDe");
	});

	it("refuses to move a hidden or unknown dessert", () => {
		expect(moveInSellOrder(catalog, 2, "up")).toBeNull();
		expect(moveInSellOrder(catalog, 99, "up")).toBeNull();
	});

	it("numbers an order so sorting by sequence reproduces it", () => {
		const order = [
			{ id: 1, sequence: 0 },
			{ id: 2, sequence: 0 },
			{ id: 3, sequence: 7 },
		];
		expect(sequencesFor(order).map(({ sequence }) => sequence)).toEqual([0, 1, 2]);
	});
});
