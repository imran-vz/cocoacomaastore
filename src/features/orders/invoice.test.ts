import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import type { OrderRecord } from "@/features/orders/contract";
import { createOrderInvoicePdf, type InvoiceAssets } from "@/features/orders/invoice";
import { dayOrdersScreen } from "@/features/orders/presentation";

const record: OrderRecord = {
	id: 1042,
	customerName: "Aarav Sharma",
	createdAt: "2026-07-15T09:30:00.000Z",
	deliveryCost: "50.00",
	total: "550.00",
	status: "completed",
	lines: [
		{
			id: 1,
			quantity: 2,
			unitPrice: "250.00",
			dessertName: "Classic Brownie",
			comboName: "Celebration Brownie Box",
			modifiers: [{ id: 1, quantity: 2, name: "Chocolate Sauce" }],
		},
	],
};

/** The order as the Orders page shows it, which is what its invoice is made from. */
function orderView(order: OrderRecord) {
	const screen = dayOrdersScreen({
		data: { day: "2026-07-15", today: "2026-07-15", orders: [order] },
		isPending: false,
		isFetching: false,
		isPlaceholderData: false,
		isRefetchError: false,
	});
	if (screen.status !== "ready") throw new Error(`The day is ${screen.status}`);
	return screen.orders.orders[0];
}

let assets: InvoiceAssets;

beforeAll(async () => {
	const [font, logo] = await Promise.all([readFile("public/Inter-Regular.ttf"), readFile("public/logo.png")]);
	assets = { font: new Uint8Array(font), logo: new Uint8Array(logo) };
});

describe("order invoice PDF", () => {
	it("creates a single-page invoice titled for the order and customer", async () => {
		const document = await createOrderInvoicePdf(orderView(record), assets);
		const pdfSource = document.output();

		expect(document.getNumberOfPages()).toBe(1);
		expect(pdfSource).toContain("/Title (Cocoa Comaa invoice #1042)");
		expect(pdfSource).toContain("/Subject (Order invoice for Aarav Sharma)");
	});

	it("refuses an order whose stored total disagrees with its lines and delivery", async () => {
		await expect(createOrderInvoicePdf(orderView({ ...record, total: "549.00" }), assets)).rejects.toThrow(
			"Order #1042 totals do not match its line items",
		);
	});

	it("continues long orders onto further pages", async () => {
		const lineCount = 35;
		const longOrder = orderView({
			...record,
			total: `${lineCount * 500 + 50}.00`,
			lines: Array.from({ length: lineCount }, (_, index) => ({
				...record.lines[0],
				id: index + 1,
				comboName: `Celebration Brownie Box ${index + 1}`,
			})),
		});

		expect((await createOrderInvoicePdf(longOrder, assets)).getNumberOfPages()).toBeGreaterThan(1);
	});

	it("splits a single oversized line across pages", async () => {
		const oversizedOrder = orderView({
			...record,
			lines: [
				{
					...record.lines[0],
					modifiers: Array.from({ length: 80 }, (_, index) => ({
						id: index + 1,
						quantity: 1,
						name: `Hand-finished chocolate garnish number ${index + 1} with roasted nuts and caramel`,
					})),
				},
			],
		});

		expect((await createOrderInvoicePdf(oversizedOrder, assets)).getNumberOfPages()).toBeGreaterThan(1);
	});
});
