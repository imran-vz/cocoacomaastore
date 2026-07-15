import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

import { createOrderInvoicePdf, getOrderInvoiceFilename, type InvoiceAssets } from "./order-invoice";
import { buildOrderInvoiceModel } from "./order-invoice-model";

const order = {
	id: 1042,
	customerName: "Aarav Sharma",
	createdAt: "2026-07-15T09:30:00.000Z",
	deliveryCost: "50.00",
	total: "550.00",
	status: "completed" as const,
	orderItems: [
		{
			id: 1,
			quantity: 2,
			unitPrice: "250.00",
			comboId: 1,
			comboName: "Celebration Brownie Box",
			dessert: { id: 1, name: "Classic Brownie" },
			modifiers: [{ id: 1, quantity: 2, dessert: { id: 2, name: "Chocolate Sauce" } }],
		},
	],
};

let assets: InvoiceAssets;

beforeAll(async () => {
	const [font, logo] = await Promise.all([readFile("public/Inter-Regular.ttf"), readFile("public/logo.png")]);
	assets = { font: new Uint8Array(font), logo: new Uint8Array(logo) };
});

describe("order invoice model", () => {
	it("builds a complete model using integer cents", () => {
		expect(buildOrderInvoiceModel(order)).toEqual({
			id: 1042,
			customerName: "Aarav Sharma",
			createdAt: "2026-07-15T09:30:00.000Z",
			status: "completed",
			lines: [
				{
					id: 1,
					name: "Celebration Brownie Box",
					details: "Includes: Classic Brownie, Chocolate Sauce x2",
					quantity: 2,
					unitPriceCents: 25_000,
					lineTotalCents: 50_000,
				},
			],
			subtotalCents: 50_000,
			deliveryCents: 5_000,
			totalCents: 55_000,
		});
	});

	it("rejects an order whose persisted total disagrees with its lines", () => {
		expect(() => buildOrderInvoiceModel({ ...order, total: "549.00" })).toThrow(
			"Order #1042 totals do not match its line items",
		);
	});
});

describe("order invoice PDF", () => {
	it("uses a stable, descriptive filename", () => {
		expect(getOrderInvoiceFilename(order.id)).toBe("cocoa-comaa-invoice-1042.pdf");
	});

	it("creates the branded single-page PDF", async () => {
		const document = await createOrderInvoicePdf(order, assets);
		const bytes = document.output("arraybuffer");
		const pdfSource = document.output();

		expect(bytes.byteLength).toBeGreaterThan(500_000);
		expect(document.getNumberOfPages()).toBe(1);
		expect(pdfSource).toContain("/Title (Cocoa Comaa invoice #1042)");
		expect(pdfSource).toContain("/Subject (Order invoice for Aarav Sharma)");
	});

	it("automatically paginates long orders using the branded renderer", async () => {
		const lineCount = 35;
		const longOrder = {
			...order,
			total: `${lineCount * 500 + 50}.00`,
			orderItems: Array.from({ length: lineCount }, (_, index) => ({
				...order.orderItems[0],
				id: index + 1,
				comboName: `Celebration Brownie Box ${index + 1}`,
			})),
		};
		const document = await createOrderInvoicePdf(longOrder, assets);

		expect(document.getNumberOfPages()).toBeGreaterThan(1);
	});

	it("splits a single oversized item across pages", async () => {
		const oversizedOrder = {
			...order,
			orderItems: [
				{
					...order.orderItems[0],
					modifiers: Array.from({ length: 80 }, (_, index) => ({
						id: index + 1,
						quantity: 1,
						dessert: {
							id: index + 2,
							name: `Hand-finished chocolate garnish number ${index + 1} with roasted nuts and caramel`,
						},
					})),
				},
			],
		};
		const document = await createOrderInvoicePdf(oversizedOrder, assets);

		expect(document.getNumberOfPages()).toBeGreaterThan(1);
	});
});
