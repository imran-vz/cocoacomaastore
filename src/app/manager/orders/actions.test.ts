import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	class SubmissionConflict extends Error {
		constructor() {
			super("This order submission was already used for different order details.");
		}
	}

	return {
		createCompletedOrder: vi.fn(),
		getOrders: vi.fn(),
		requireManagerAccess: vi.fn(),
		requireSession: vi.fn().mockResolvedValue({ id: "manager-1" }),
		serializeOrders: vi.fn(),
		SubmissionConflict,
	};
});

vi.mock("@/lib/auth/guards", () => ({
	requireManagerAccess: mocks.requireManagerAccess,
	requireSession: mocks.requireSession,
}));

vi.mock("@/lib/order-lifecycle", () => ({
	cancelOrderAsNormalPath: vi.fn(),
	createCompletedOrder: mocks.createCompletedOrder,
	getOrders: mocks.getOrders,
	OrderSubmissionConflictError: mocks.SubmissionConflict,
	serializeOrders: mocks.serializeOrders,
}));

import { createOrderWithLines, getOrders } from "./actions";

const receipt = {
	id: 42,
	customerName: "Ada",
	createdAt: "2026-07-17T10:00:00.000Z",
	status: "completed" as const,
	lines: [
		{
			id: 7,
			name: "Brownie",
			details: "",
			quantity: 1,
			unitPriceCents: 10_000,
			lineTotalCents: 10_000,
		},
	],
	subtotalCents: 10_000,
	deliveryCents: 0,
	totalCents: 10_000,
};

const input = {
	submissionId: "93d933ae-adf6-4aec-a024-200fba2e3cd5",
	customerName: "Ada",
	lines: [{ baseDessertId: 1, quantity: 1 }],
	deliveryCost: "0.00",
};

describe("getOrders", () => {
	it("reads current manager orders without the long-lived order cache", async () => {
		const currentOrders = [{ id: 7 }];
		const serializedOrders = [{ id: 7, createdAt: "2026-07-17T10:00:00.000Z" }];
		mocks.getOrders.mockResolvedValueOnce(currentOrders);
		mocks.serializeOrders.mockReturnValueOnce(serializedOrders);

		await expect(getOrders()).resolves.toBe(serializedOrders);

		expect(mocks.requireManagerAccess).toHaveBeenCalledOnce();
		expect(mocks.getOrders).toHaveBeenCalledOnce();
		expect(mocks.serializeOrders).toHaveBeenCalledWith(currentOrders);
	});
});

describe("createOrderWithLines", () => {
	it("serializes the expected submission conflict for the POS", async () => {
		mocks.createCompletedOrder.mockRejectedValueOnce(new mocks.SubmissionConflict());

		await expect(createOrderWithLines(input)).resolves.toEqual({
			ok: false,
			error: "This order submission was already used for different order details.",
		});
	});

	it("serializes a successful durable acknowledgement", async () => {
		mocks.createCompletedOrder.mockResolvedValueOnce({ orderId: 42, receipt, replayed: false, refreshWarning: false });

		await expect(createOrderWithLines(input)).resolves.toEqual({
			ok: true,
			orderId: 42,
			receipt,
			replayed: false,
			refreshWarning: false,
		});
	});
});
