import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	class SubmissionConflict extends Error {
		constructor() {
			super("This order submission was already used for different order details.");
		}
	}

	return {
		createCompletedOrder: vi.fn(),
		requireSession: vi.fn().mockResolvedValue({ id: "manager-1" }),
		SubmissionConflict,
	};
});

vi.mock("@/lib/auth/guards", () => ({
	requireManagerAccess: vi.fn(),
	requireSession: mocks.requireSession,
}));

vi.mock("@/lib/order-lifecycle", () => ({
	cancelOrderAsNormalPath: vi.fn(),
	createCompletedOrder: mocks.createCompletedOrder,
	getCachedOrders: vi.fn(),
	OrderSubmissionConflictError: mocks.SubmissionConflict,
	serializeOrders: vi.fn(),
}));

import { createOrderWithLines } from "./actions";

const input = {
	submissionId: "93d933ae-adf6-4aec-a024-200fba2e3cd5",
	customerName: "Ada",
	lines: [{ baseDessertId: 1, quantity: 1 }],
	deliveryCost: "0.00",
};

describe("createOrderWithLines", () => {
	it("serializes the expected submission conflict for the POS", async () => {
		mocks.createCompletedOrder.mockRejectedValueOnce(new mocks.SubmissionConflict());

		await expect(createOrderWithLines(input)).resolves.toEqual({
			ok: false,
			error: "This order submission was already used for different order details.",
		});
	});

	it("serializes a successful durable acknowledgement", async () => {
		mocks.createCompletedOrder.mockResolvedValueOnce({ orderId: 42, replayed: false, refreshWarning: false });

		await expect(createOrderWithLines(input)).resolves.toEqual({
			ok: true,
			orderId: 42,
			replayed: false,
			refreshWarning: false,
		});
	});
});
