import { describe, expect, it, vi } from "vitest";
import type { CreateOrderInput } from "@/features/orders/contract";
import type { CartLine } from "@/features/pos/cart";
import {
	createOrderSubmitter,
	deliveryFeeCents,
	type OrderDraft,
	orderCopyText,
	orderTotalCents,
	upiPaymentLink,
} from "@/features/pos/checkout";

type SaveOrder = Parameters<typeof createOrderSubmitter>[0];

const brownies: CartLine = {
	cartLineId: "line-1",
	baseDessertId: 1,
	name: "brownie",
	hasUnlimitedStock: false,
	unitPrice: 100,
	quantity: 2,
};
const blast: CartLine = { ...brownies, cartLineId: "line-2", comboId: 10, name: "brownie blast", unitPrice: 200 };

const draft: OrderDraft = { lines: [brownies, blast], customerName: "  Ada  ", deliveryCost: "25", intentVersion: 0 };

const saved = { ok: true as const, data: { orderId: 42, day: "2026-07-17", replayed: false } };

function submitterWith(saveOrder: SaveOrder) {
	let next = 0;
	return createOrderSubmitter(saveOrder, () => `submission-${++next}`);
}

function sentIds(saveOrder: ReturnType<typeof vi.fn>) {
	return saveOrder.mock.calls.map(([input]) => (input as CreateOrderInput).submissionId);
}

describe("saving a POS order", () => {
	it("sends references only, with the name trimmed and the delivery fee as a two-decimal amount", async () => {
		const saveOrder = vi.fn<SaveOrder>().mockResolvedValue(saved);

		await expect(submitterWith(saveOrder)(draft)).resolves.toEqual(saved);
		expect(saveOrder).toHaveBeenCalledWith({
			customerName: "Ada",
			deliveryCost: "25.00",
			lines: [
				{ baseDessertId: 1, quantity: 2 },
				{ baseDessertId: 1, comboId: 10, quantity: 2 },
			],
			submissionId: "submission-1",
		});
	});

	it("sends the delivery fee as the server stores it, and an unreadable one as typed for the server to refuse", async () => {
		const saveOrder = vi.fn<SaveOrder>().mockResolvedValue(saved);
		const submit = submitterWith(saveOrder);
		for (const deliveryCost of ["", " .5 ", "40.", "40.555", "-5"]) await submit({ ...draft, deliveryCost });

		expect(saveOrder.mock.calls.map(([input]) => input.deliveryCost)).toEqual([
			"0.00",
			"0.50",
			"40.00",
			"40.555",
			"-5",
		]);
	});

	it("retries a refused or unanswered save with the same submission id, so the server cannot save it twice", async () => {
		const lost = { ok: false as const, error: "Check the connection" };
		const saveOrder = vi
			.fn<SaveOrder>()
			.mockResolvedValueOnce({ ok: false, error: "Only 1 left" })
			.mockResolvedValueOnce(lost)
			.mockResolvedValueOnce(saved);
		const submit = submitterWith(saveOrder);

		await expect(submit(draft)).resolves.toEqual({ ok: false, error: "Only 1 left" });
		await expect(submit(draft)).resolves.toEqual(lost);
		await expect(submit(draft)).resolves.toEqual(saved);
		expect(sentIds(saveOrder)).toEqual(["submission-1", "submission-1", "submission-1"]);
	});

	it("treats the same lines in another order or under other local names as the same order", async () => {
		const saveOrder = vi.fn<SaveOrder>().mockResolvedValue({ ok: false, error: "Try again" });
		const submit = submitterWith(saveOrder);

		await submit(draft);
		await submit({ ...draft, lines: [{ ...blast, name: "renamed" }, brownies], customerName: "Ada" });

		expect(sentIds(saveOrder)).toEqual(["submission-1", "submission-1"]);
	});

	it("uses a new submission id for a changed order, a new order, and the order after a save", async () => {
		const saveOrder = vi.fn<SaveOrder>().mockResolvedValue({ ok: false, error: "Try again" });
		const submit = submitterWith(saveOrder);

		await submit(draft);
		await submit({ ...draft, lines: [{ ...brownies, quantity: 3 }, blast] });
		await submit({ ...draft, lines: [{ ...brownies, quantity: 3 }, blast], intentVersion: 1 });
		saveOrder.mockResolvedValueOnce(saved);
		await submit({ ...draft, intentVersion: 1 });
		await submit({ ...draft, intentVersion: 1 });

		expect(sentIds(saveOrder)).toEqual([
			"submission-1",
			"submission-2",
			"submission-3",
			"submission-4",
			"submission-5",
		]);
	});

	it("sends nothing for an empty cart or while a save is in flight", async () => {
		let finish: (value: typeof saved) => void = () => undefined;
		const saveOrder = vi.fn<SaveOrder>(() => new Promise((resolve) => (finish = resolve)));
		const submit = submitterWith(saveOrder);

		expect(submit({ ...draft, lines: [] })).toBeNull();
		const first = submit(draft);
		expect(submit(draft)).toBeNull();
		finish(saved);
		await first;

		expect(saveOrder).toHaveBeenCalledTimes(1);
		expect(submit(draft)).not.toBeNull();
	});
});

describe("delivery fee field", () => {
	it("reads a typed rupee amount exactly, and an empty field as no fee", () => {
		expect(deliveryFeeCents("25.5")).toBe(2_550);
		expect(deliveryFeeCents("0.29")).toBe(29);
		expect(deliveryFeeCents("")).toBe(0);
	});

	it("reads anything else as no amount", () => {
		for (const field of ["25.555", "-5", "1e3", "."]) expect(deliveryFeeCents(field)).toBeNull();
	});
});

describe("order text for online customers", () => {
	it("lists each line, the delivery fee and the total", () => {
		expect(orderCopyText([brownies, blast], 2_500)).toBe(
			["Brownie × 2 = ₹200.00", "Brownie Blast × 2 = ₹400.00", "Delivery: ₹25.00", "------", "Total: ₹625.00"].join(
				"\n",
			),
		);
	});

	it("leaves out the delivery line when there is no fee", () => {
		expect(orderCopyText([brownies], 0)).not.toContain("Delivery");
	});

	it("builds a UPI payment link for the total with the item names as the note", () => {
		const link = new URL(upiPaymentLink("store@upi", 62_500, [brownies, blast]));

		expect(link.protocol).toBe("upi:");
		expect(link.searchParams.get("pa")).toBe("store@upi");
		expect(link.searchParams.get("am")).toBe("625.00");
		expect(link.searchParams.get("tn")).toBe("brownie, brownie blast");
	});

	it("asks for the exact total when the delivery fee has paise", () => {
		const tenRupees = { ...brownies, unitPrice: 10, quantity: 1 };
		const fee = deliveryFeeCents("1.12") ?? 0;
		const link = new URL(upiPaymentLink("store@upi", orderTotalCents([tenRupees], fee), [tenRupees]));

		expect(link.searchParams.get("am")).toBe("11.12");
	});

	it("shortens a long note", () => {
		const many = Array.from({ length: 10 }, (_, index) => ({ ...brownies, name: `dessert number ${index}` }));
		const note = new URL(upiPaymentLink("store@upi", 100, many)).searchParams.get("tn") ?? "";

		expect(note).toHaveLength(63);
		expect(note.endsWith("...")).toBe(true);
	});
});
