import { BRAND_NAME } from "@/components/ui/brand";
import { type CreateOrderAck, type CreateOrderInput, serializeOrderSubmission } from "@/features/orders/contract";
import { type CartLine, lineTotalCents, orderRequestLines } from "@/features/pos/cart";
import type { ActionResult } from "@/lib/action-result";
import { capitalizeWords, formatINR } from "@/lib/format";
import { centsToDecimal, rupees, typedAmountCents } from "@/lib/money";

/** The delivery fee field in paise: empty is no fee, and null means it holds no rupee amount. */
export function deliveryFeeCents(field: string): number | null {
	return field.trim() === "" ? 0 : typedAmountCents(field);
}

/** What the customer pays in paise: the lines, plus the delivery fee. */
export function orderTotalCents(lines: readonly CartLine[], deliveryCents: number): number {
	return lines.reduce((sum, line) => sum + lineTotalCents(line), deliveryCents);
}

/** What the cashier has entered for the order being saved. */
export type OrderDraft = {
	lines: readonly CartLine[];
	customerName: string;
	/** The delivery fee field as typed. */
	deliveryCost: string;
	intentVersion: number;
};

/**
 * Sends orders one at a time. A retry of the same order (same request, same `intentVersion`) reuses its
 * submission id, so the server replays a save whose answer was lost instead of saving it twice; a changed
 * request or a new order gets a new id. Returns null without sending when the cart is empty or a save is
 * already in flight. `saveOrder` answers every save, a failed one included; it never rejects.
 */
export function createOrderSubmitter(
	saveOrder: (input: CreateOrderInput) => Promise<ActionResult<CreateOrderAck>>,
	newSubmissionId = () => globalThis.crypto.randomUUID(),
) {
	let pending: { fingerprint: string; intentVersion: number; submissionId: string } | null = null;
	let inFlight = false;

	return (draft: OrderDraft): Promise<ActionResult<CreateOrderAck>> | null => {
		if (draft.lines.length === 0 || inFlight) return null;

		const fee = deliveryFeeCents(draft.deliveryCost);
		const request = {
			customerName: draft.customerName.trim(),
			// A fee that is not a rupee amount goes as typed, for the server to refuse with its message.
			deliveryCost: fee === null ? draft.deliveryCost.trim() : centsToDecimal(fee),
			lines: orderRequestLines(draft.lines),
		};
		const fingerprint = serializeOrderSubmission(request);
		if (pending?.fingerprint !== fingerprint || pending.intentVersion !== draft.intentVersion) {
			pending = { fingerprint, intentVersion: draft.intentVersion, submissionId: newSubmissionId() };
		}
		const { submissionId } = pending;

		inFlight = true;
		return saveOrder({ ...request, submissionId })
			.then((result) => {
				if (result.ok) pending = null;
				return result;
			})
			.finally(() => {
				inFlight = false;
			});
	};
}

/** The order as plain text the cashier pastes into a chat with an online customer. */
export function orderCopyText(lines: readonly CartLine[], deliveryCents: number): string {
	const money = (cents: number) => formatINR(rupees(cents), { paise: "always" });
	const items = lines.map(
		(line) => `${capitalizeWords(line.name.trim())} × ${line.quantity} = ${money(lineTotalCents(line))}`,
	);
	const deliveryLine = deliveryCents > 0 ? [`Delivery: ${money(deliveryCents)}`] : [];
	return [...items, ...deliveryLine, "------", `Total: ${money(orderTotalCents(lines, deliveryCents))}`].join("\n");
}

const UPI_NOTE_LENGTH = 60;

/**
 * A UPI deep link (`upi://pay`) for the order total, which payment apps open from a QR code.
 * `pa` is the payee's UPI id, `pn` the payee name, `am` the amount and `tn` the note shown to the payer.
 */
export function upiPaymentLink(upiId: string, totalCents: number, lines: readonly CartLine[]): string {
	const names = lines.map((line) => line.name).join(", ");
	const note = names.length > UPI_NOTE_LENGTH ? `${names.slice(0, UPI_NOTE_LENGTH)}...` : names;
	const params = new URLSearchParams({ am: centsToDecimal(totalCents), pn: BRAND_NAME, tn: note });
	return `upi://pay?pa=${upiId}&${params.toString()}`;
}
