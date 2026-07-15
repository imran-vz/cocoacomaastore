import type { SerializedOrderDetails } from "@/lib/order-lifecycle";

export type OrderInvoiceLine = {
	id: number;
	name: string;
	details: string;
	quantity: number;
	unitPriceCents: number;
	lineTotalCents: number;
};

export type OrderInvoiceModel = {
	id: number;
	customerName: string;
	createdAt: string;
	status: SerializedOrderDetails["status"];
	lines: OrderInvoiceLine[];
	subtotalCents: number;
	deliveryCents: number;
	totalCents: number;
};

function parseMoneyToCents(value: string, field: string) {
	const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
	if (!match) {
		throw new Error(`Invalid ${field}: ${value}`);
	}

	const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
	if (!Number.isSafeInteger(cents)) {
		throw new Error(`${field} is outside the supported range`);
	}

	return cents;
}

function getItemDetails(item: SerializedOrderDetails["orderItems"][number]) {
	const modifiers = item.modifiers.map((modifier) =>
		modifier.quantity > 1 ? `${modifier.dessert.name} x${modifier.quantity}` : modifier.dessert.name,
	);

	if (item.comboName) {
		return `Includes: ${[item.dessert.name, ...modifiers].join(", ")}`;
	}

	return modifiers.length > 0 ? `Add-ons: ${modifiers.join(", ")}` : "";
}

export function buildOrderInvoiceModel(order: SerializedOrderDetails): OrderInvoiceModel {
	const lines = order.orderItems.map((item) => {
		const unitPriceCents = parseMoneyToCents(item.unitPrice, `unit price for order item ${item.id}`);
		return {
			id: item.id,
			name: item.comboName || item.dessert.name,
			details: getItemDetails(item),
			quantity: item.quantity,
			unitPriceCents,
			lineTotalCents: unitPriceCents * item.quantity,
		};
	});
	const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
	const deliveryCents = parseMoneyToCents(order.deliveryCost, "delivery cost");
	const totalCents = parseMoneyToCents(order.total, "order total");

	if (subtotalCents + deliveryCents !== totalCents) {
		throw new Error(`Order #${order.id} totals do not match its line items`);
	}

	return {
		id: order.id,
		customerName: order.customerName || "Walk-in Customer",
		createdAt: order.createdAt,
		status: order.status,
		lines,
		subtotalCents,
		deliveryCents,
		totalCents,
	};
}
