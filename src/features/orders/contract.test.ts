import { describe, expect, it } from "vitest";
import {
	cancelOrderSchema,
	createOrderSchema,
	MAX_ORDER_CANCELLATION_REASON_LENGTH,
	sanitizeCustomerName,
	serializeOrderSubmission,
} from "@/features/orders/contract";

const submissionId = "123e4567-e89b-42d3-a456-426614174000";

describe("order request", () => {
	it("accepts direct and combo references and normalizes the name and delivery cost", () => {
		expect(
			createOrderSchema.parse({
				submissionId,
				customerName: "  Aarav <b>Patel</b>  ",
				lines: [
					{ baseDessertId: 1, quantity: 2 },
					{ baseDessertId: 2, comboId: 3, quantity: 1 },
				],
				deliveryCost: "50.5",
			}),
		).toEqual({
			submissionId,
			customerName: "Aarav Patel",
			lines: [
				{ baseDessertId: 1, quantity: 2 },
				{ baseDessertId: 2, comboId: 3, quantity: 1 },
			],
			deliveryCost: "50.50",
		});
	});

	it("rejects client-owned cart details and unknown request fields", () => {
		const request = { submissionId, customerName: "", lines: [{ baseDessertId: 1, quantity: 1 }], deliveryCost: "0" };
		expect(
			createOrderSchema.safeParse({ ...request, lines: [{ baseDessertId: 1, quantity: 1, unitPrice: 0 }] }).success,
		).toBe(false);
		expect(createOrderSchema.safeParse({ ...request, total: 0 }).success).toBe(false);
		expect(createOrderSchema.safeParse({ ...request, submissionId: "not-a-uuid" }).success).toBe(false);
	});

	it("bounds line quantities and the delivery cost by what the database stores", () => {
		const request = {
			submissionId,
			customerName: "",
			lines: [{ baseDessertId: 1, quantity: 99 }],
			deliveryCost: "999.99",
		};
		expect(createOrderSchema.safeParse(request).success).toBe(true);
		expect(createOrderSchema.safeParse({ ...request, lines: [{ baseDessertId: 1, quantity: 100 }] }).success).toBe(
			false,
		);
		expect(createOrderSchema.safeParse({ ...request, deliveryCost: "1000.00" }).success).toBe(false);
		expect(createOrderSchema.safeParse({ ...request, deliveryCost: "1.234" }).success).toBe(false);
		expect(createOrderSchema.safeParse({ ...request, deliveryCost: "-1" }).success).toBe(false);
	});

	it("normalizes a customer name to one that normalizing again leaves unchanged", () => {
		for (const name of ["Bob !!", "!! Bob", " <i>Ada</i> ?", "Zoë O'Neil-Smith."]) {
			const once = sanitizeCustomerName(name);
			expect(once).toBe(once.trim());
			expect(sanitizeCustomerName(once)).toBe(once);
		}
		expect(sanitizeCustomerName("Bob !!")).toBe("Bob");
	});

	it("fingerprints the same request identically whatever the line order and name formatting", () => {
		const request = {
			customerName: "  Aarav <b>Patel</b>  ",
			deliveryCost: "5.00",
			lines: [
				{ baseDessertId: 10, quantity: 2 },
				{ baseDessertId: 11, comboId: 30, quantity: 1 },
			],
		};
		const fingerprint = serializeOrderSubmission(request);

		expect(
			serializeOrderSubmission({
				customerName: "Aarav Patel",
				deliveryCost: "5.00",
				lines: [...request.lines].reverse(),
			}),
		).toBe(fingerprint);
		for (const changed of [
			{ ...request, customerName: "Different" },
			{ ...request, deliveryCost: "5.01" },
			{ ...request, lines: [{ baseDessertId: 12, quantity: 2 }, request.lines[1]] },
			{ ...request, lines: [request.lines[0], { baseDessertId: 11, comboId: 31, quantity: 1 }] },
			{ ...request, lines: [{ baseDessertId: 10, quantity: 3 }, request.lines[1]] },
		]) {
			expect(serializeOrderSubmission(changed)).not.toBe(fingerprint);
		}
	});
});

describe("cancellation request", () => {
	it("accepts the longest reason whose audit note still fits", () => {
		const reason = "x".repeat(MAX_ORDER_CANCELLATION_REASON_LENGTH);
		expect(cancelOrderSchema.parse({ orderId: 1, reason })).toEqual({ orderId: 1, reason });
		expect(cancelOrderSchema.safeParse({ orderId: 1, reason: `${reason}x` }).success).toBe(false);
	});
});
