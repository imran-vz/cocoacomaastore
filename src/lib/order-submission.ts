import { sanitizeCustomerName } from "@/lib/sanitize";
import type { OrderRequestLine } from "@/lib/types";

export type OrderSubmissionPayload = {
	customerName: string;
	deliveryCost: string | number;
	lines: readonly OrderRequestLine[];
};

export function normalizeDeliveryCost(deliveryCost: string | number): string {
	const value = typeof deliveryCost === "number" ? deliveryCost : Number.parseFloat(deliveryCost || "0");
	return value.toFixed(2);
}

export function normalizeOrderSubmission(payload: OrderSubmissionPayload) {
	return {
		customerName: sanitizeCustomerName(payload.customerName),
		deliveryCost: normalizeDeliveryCost(payload.deliveryCost),
		lines: payload.lines
			.map((line) => ({
				baseDessertId: line.baseDessertId,
				comboId: line.comboId ?? null,
				quantity: line.quantity,
			}))
			.sort(
				(left, right) =>
					left.baseDessertId - right.baseDessertId ||
					(left.comboId ?? -1) - (right.comboId ?? -1) ||
					left.quantity - right.quantity,
			),
	};
}

export function serializeOrderSubmission(payload: OrderSubmissionPayload): string {
	return JSON.stringify(normalizeOrderSubmission(payload));
}
