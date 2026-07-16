import { describe, expect, test } from "vitest";
import {
	canCancelOrderOnOperatingDay,
	getCartLineInventoryDeductions,
	getOrderInventoryRestorationsFromAudits,
	resolveOrderLinesFromCatalog,
	serializeOrders,
} from "@/lib/order-lifecycle";

const base = {
	id: 10,
	name: "Classic Box",
	price: 100,
	kind: "base" as const,
	enabled: true,
	isDeleted: false,
	hasUnlimitedStock: false,
};
const modifier = {
	id: 20,
	name: "Sprinkles",
	price: 15,
	kind: "modifier" as const,
	enabled: true,
	isDeleted: false,
	hasUnlimitedStock: true,
};
const combo = {
	id: 30,
	name: "Party Box",
	baseDessertId: base.id,
	overridePrice: null,
	enabled: true,
	isDeleted: false,
};
const comboItem = { comboId: combo.id, dessertId: modifier.id, quantity: 2 };

describe("order-lifecycle", () => {
	describe("authoritative catalog resolution", () => {
		test("uses the current direct price and additive combo price", () => {
			const direct = resolveOrderLinesFromCatalog({
				lines: [{ baseDessertId: base.id, quantity: 2 }],
				desserts: [base],
				combos: [],
				comboItems: [],
			});
			const combined = resolveOrderLinesFromCatalog({
				lines: [{ baseDessertId: base.id, comboId: combo.id, quantity: 1 }],
				desserts: [base, modifier],
				combos: [combo],
				comboItems: [comboItem],
			});

			expect(direct[0]).toMatchObject({ baseDessertName: base.name, unitPrice: 100, modifiers: [] });
			expect(combined[0]).toMatchObject({
				comboName: combo.name,
				unitPrice: 130,
				modifiers: [{ dessertId: modifier.id, dessertName: modifier.name, quantity: 2 }],
			});
		});

		test("uses a combo override price", () => {
			const [resolved] = resolveOrderLinesFromCatalog({
				lines: [{ baseDessertId: base.id, comboId: combo.id, quantity: 1 }],
				desserts: [base, modifier],
				combos: [{ ...combo, overridePrice: 75 }],
				comboItems: [comboItem],
			});
			expect(resolved.unitPrice).toBe(75);
		});

		test("rejects mismatched, inactive, missing, and duplicate references", () => {
			const input = {
				lines: [{ baseDessertId: base.id, comboId: combo.id, quantity: 1 }],
				desserts: [base, modifier],
				combos: [combo],
				comboItems: [comboItem],
			};
			expect(() => resolveOrderLinesFromCatalog({ ...input, combos: [{ ...combo, baseDessertId: 999 }] })).toThrow(
				"does not match",
			);
			expect(() =>
				resolveOrderLinesFromCatalog({ ...input, desserts: [{ ...base, enabled: false }, modifier] }),
			).toThrow("inactive");
			expect(() => resolveOrderLinesFromCatalog({ ...input, combos: [] })).toThrow("missing");
			expect(() => resolveOrderLinesFromCatalog({ ...input, lines: [...input.lines, ...input.lines] })).toThrow(
				"Duplicate",
			);
		});

		test("rejects prices outside numeric persistence bounds", () => {
			expect(
				resolveOrderLinesFromCatalog({
					lines: [{ baseDessertId: base.id, quantity: 1 }],
					desserts: [{ ...base, price: 99_999_999 }],
					combos: [],
					comboItems: [],
				})[0]?.unitPrice,
			).toBe(99_999_999);
			expect(() =>
				resolveOrderLinesFromCatalog({
					lines: [{ baseDessertId: base.id, quantity: 1 }],
					desserts: [{ ...base, price: 100_000_000 }],
					combos: [],
					comboItems: [],
				}),
			).toThrow("supported amount");
			expect(() =>
				resolveOrderLinesFromCatalog({
					lines: [{ baseDessertId: base.id, quantity: 1 }],
					desserts: [{ ...base, price: -1 }],
					combos: [],
					comboItems: [],
				}),
			).toThrow("supported amount");
			expect(() =>
				resolveOrderLinesFromCatalog({
					lines: [{ baseDessertId: base.id, comboId: combo.id, quantity: 1 }],
					desserts: [base, modifier],
					combos: [{ ...combo, overridePrice: 100_000_000 }],
					comboItems: [comboItem],
				}),
			).toThrow("supported amount");
			expect(() =>
				resolveOrderLinesFromCatalog({
					lines: [{ baseDessertId: base.id, comboId: combo.id, quantity: 1 }],
					desserts: [base, { ...modifier, price: -1 }],
					combos: [combo],
					comboItems: [comboItem],
				}),
			).toThrow("supported amount");
		});
	});

	test("aggregates resolved base quantities and ignores unlimited stock", () => {
		const lines = resolveOrderLinesFromCatalog({
			lines: [
				{ baseDessertId: base.id, quantity: 2 },
				{ baseDessertId: 11, quantity: 8 },
			],
			desserts: [base, { ...base, id: 11, name: "Bag", hasUnlimitedStock: true }],
			combos: [],
			comboItems: [],
		});
		expect(getCartLineInventoryDeductions(lines)).toEqual([{ dessertId: base.id, quantity: 2, name: base.name }]);
	});

	test("derives cancellation restoration only from valid deduction audits", () => {
		const day = new Date("2026-07-15T00:00:00.000Z");
		const deductedItems = [{ baseDessertName: base.name, dessertId: base.id, inventoryDeducted: true }];
		expect(
			getOrderInventoryRestorationsFromAudits(
				[{ day, dessertId: base.id, previousQuantity: 7, newQuantity: 3 }],
				deductedItems,
				day,
			),
		).toEqual([{ dessertId: base.id, quantity: 4, name: base.name }]);
		expect(() =>
			getOrderInventoryRestorationsFromAudits(
				[{ day, dessertId: base.id, previousQuantity: 3, newQuantity: 3 }],
				deductedItems,
				day,
			),
		).toThrow("malformed");
		expect(() => getOrderInventoryRestorationsFromAudits([], deductedItems, day)).toThrow("does not match");
		expect(() =>
			getOrderInventoryRestorationsFromAudits(
				[{ day, dessertId: 999, previousQuantity: 2, newQuantity: 1 }],
				deductedItems,
				day,
			),
		).toThrow("does not match");
		expect(() =>
			getOrderInventoryRestorationsFromAudits(
				[
					{ day, dessertId: base.id, previousQuantity: 2, newQuantity: 1 },
					{ day, dessertId: base.id, previousQuantity: 2, newQuantity: 1 },
				],
				deductedItems,
				day,
			),
		).toThrow("malformed");
		expect(
			getOrderInventoryRestorationsFromAudits(
				[],
				[{ baseDessertName: "Bag", dessertId: 11, inventoryDeducted: false }],
				day,
			),
		).toEqual([]);
	});

	test("only allows cancellation on the same operating day", () => {
		expect(
			canCancelOrderOnOperatingDay(new Date("2026-05-21T04:30:00.000Z"), new Date("2026-05-21T12:00:00.000Z")),
		).toBe(true);
		expect(
			canCancelOrderOnOperatingDay(new Date("2026-05-20T12:00:00.000Z"), new Date("2026-05-21T12:00:00.000Z")),
		).toBe(false);
	});

	test("serializes order dates at the client boundary", () => {
		const [serialized] = serializeOrders([
			{
				id: 42,
				customerName: "Aarav",
				createdAt: new Date("2026-07-15T09:30:00.000Z"),
				deliveryCost: "0.00",
				total: "250.00",
				status: "completed",
				orderItems: [
					{
						id: 1,
						quantity: 1,
						unitPrice: "250.00",
						comboId: null,
						comboName: null,
						dessert: { id: 1, name: "Brownie" },
						modifiers: [],
					},
				],
			},
		]);

		expect(serialized.createdAt).toBe("2026-07-15T09:30:00.000Z");
	});
});
