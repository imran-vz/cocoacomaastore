import { z } from "zod";
import type { Area } from "@/features/access/area";
import type { OrderStatus } from "@/features/orders/sale";
import type { ActionResult } from "@/lib/action-result";
import { centsToDecimal, isDecimalAmount, toCents } from "@/lib/money";
import { stripMarkup } from "@/lib/sanitize";
import type { DayKey } from "@/lib/shop-calendar";

/** `orders.deliveryCost` is numeric(5,2). */
export const MAX_DELIVERY_COST = 999.99;
/** `orders.customerName` is varchar(255). */
export const MAX_CUSTOMER_NAME_LENGTH = 255;
/** `order_items.unitPrice` is numeric(10,2); catalog prices are whole rupees. */
export const MAX_UNIT_PRICE = 99_999_999;
/** `orders.total` is numeric(10,2). */
export const MAX_ORDER_TOTAL_CENTS = 9_999_999_999;
export const MAX_ORDER_LINE_QUANTITY = 99;
const MAX_ORDER_LINES = 100;

/** `inventory_audit_log.note` is varchar(500); a cancellation stores its reason there. */
const MAX_AUDIT_NOTE_LENGTH = 500;
const CANCELLATION_NOTE_PREFIX = "Order cancelled: ";
export const MAX_ORDER_CANCELLATION_REASON_LENGTH = MAX_AUDIT_NOTE_LENGTH - CANCELLATION_NOTE_PREFIX.length;

/** How an order without a customer name is shown. */
export const WALK_IN_CUSTOMER = "Walk-in";

export function cancellationNote(reason: string | undefined): string {
	return reason ? `${CANCELLATION_NOTE_PREFIX}${reason}` : "Order cancelled - stock restored";
}

/** An order may be cancelled only on the shop day it was placed, so closed days' reports never change. */
export function canCancelOn(day: DayKey, today: DayKey): boolean {
	return day === today;
}

/** Every staff member works today's orders; only admins open other days. */
export function canBrowsePastDays(area: Area): boolean {
	return area === "admin";
}

/** Keeps letters, digits, spaces and name punctuation (`.,'-`), and drops markup. */
export function sanitizeCustomerName(name: string): string {
	return stripMarkup(name)
		.replace(/[^\p{L}\p{N}\s.,'-]/gu, "")
		.slice(0, MAX_CUSTOMER_NAME_LENGTH)
		.trim();
}

const orderLineSchema = z
	.object({
		baseDessertId: z.number().int().positive(),
		comboId: z.number().int().positive().optional(),
		quantity: z.number().int().min(1).max(MAX_ORDER_LINE_QUANTITY),
	})
	.strict();

/** What the POS sends to save an order: references only; the server prices them from the catalog. */
export const createOrderSchema = z
	.object({
		submissionId: z.uuid(),
		customerName: z.string().max(MAX_CUSTOMER_NAME_LENGTH).transform(sanitizeCustomerName),
		lines: z.array(orderLineSchema).min(1).max(MAX_ORDER_LINES),
		deliveryCost: z
			.string()
			.refine(isDecimalAmount, { error: "Enter the delivery fee in rupees, with at most two decimals", abort: true })
			.refine(
				(value) => toCents(value) <= Math.round(MAX_DELIVERY_COST * 100),
				`Delivery cost must be between 0 and ${MAX_DELIVERY_COST}`,
			)
			.transform((value) => centsToDecimal(toCents(value))),
	})
	.strict();

export type OrderRequestLine = z.infer<typeof orderLineSchema>;
export type CreateOrderInput = z.input<typeof createOrderSchema>;
export type CreateOrderRequest = z.output<typeof createOrderSchema>;

export const cancelOrderSchema = z.object({
	orderId: z.number().int().positive(),
	reason: z.string().trim().min(1).max(MAX_ORDER_CANCELLATION_REASON_LENGTH).optional(),
});

/**
 * The server's acknowledgement of a saved order: `day` is the shop day it was placed on, as the
 * server reckons it, and `replayed` means this submission was already saved.
 */
export type CreateOrderAck = { orderId: number; day: DayKey; replayed: boolean };

/** Cancels an order from the Orders page, with an optional reason. */
export type CancelOrderHandler = (orderId: number, reason?: string) => Promise<ActionResult>;

/**
 * The request as the server fingerprints it for idempotency: the same customer, delivery cost and
 * lines in any order give the same string. The POS uses it to decide when a retry may reuse its
 * submission id.
 */
export function serializeOrderSubmission(request: {
	customerName: string;
	/** Two-decimal rupees, as `centsToDecimal` writes them. */
	deliveryCost: string;
	lines: readonly OrderRequestLine[];
}): string {
	return JSON.stringify({
		customerName: sanitizeCustomerName(request.customerName),
		deliveryCost: request.deliveryCost,
		lines: request.lines
			.map((line) => ({ baseDessertId: line.baseDessertId, comboId: line.comboId ?? null, quantity: line.quantity }))
			.sort(
				(left, right) =>
					left.baseDessertId - right.baseDessertId ||
					(left.comboId ?? -1) - (right.comboId ?? -1) ||
					left.quantity - right.quantity,
			),
	});
}

export type OrderLineRecord = {
	id: number;
	quantity: number;
	/** Decimal rupees, snapshotted when the order was saved. */
	unitPrice: string;
	dessertName: string;
	comboName: string | null;
	modifiers: { id: number; name: string; quantity: number }[];
};

/** A placed order as the Orders pages and the invoice read it. Amounts are decimal rupee strings. */
export type OrderRecord = {
	id: number;
	customerName: string | null;
	createdAt: string;
	status: OrderStatus;
	deliveryCost: string;
	total: string;
	lines: OrderLineRecord[];
};

/** One shop day's orders, with the server's `today` so clients apply the cancel rule on shop time. */
export type DayOrders = { day: DayKey; today: DayKey; orders: OrderRecord[] };
