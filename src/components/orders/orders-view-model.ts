import { formatCount, formatINR, formatNumber, formatTime } from "@/lib/format";
import type { SerializedOrderDetails, SerializedOrders } from "@/lib/order-lifecycle";

type OrderModifierViewModel = {
	id: number;
	name: string;
	quantity: number;
};

type OrderLineViewModel = {
	id: number;
	name: string;
	baseDessertName: string | null;
	quantity: number;
	/** Unit price × quantity, formatted (`₹180`). Matches the invoice line total. */
	lineTotalLabel: string;
	isCombo: boolean;
	modifiers: OrderModifierViewModel[];
};

export type OrderViewModel = {
	source: SerializedOrderDetails;
	id: number;
	orderLabel: string;
	customerName: string;
	isWalkInCustomer: boolean;
	createdAtTimestamp: number;
	timeLabel: string;
	status: SerializedOrderDetails["status"];
	statusLabel: string;
	isCancelled: boolean;
	totalItems: number;
	/** `5 items`, `1 item`. */
	itemsLabel: string;
	itemsSummary: string;
	/** The first line on its own (`Rocky Road Brownie ×2`), so a row stays recognisable. */
	firstItemLabel: string;
	/** `+4 more` when the order has other lines, else null. */
	moreItemsLabel: string | null;
	totalLabel: string;
	deliveryCostLabel: string | null;
	lines: OrderLineViewModel[];
};

export type OrdersViewModel = {
	totalOrders: number;
	itemsSold: number;
	orders: OrderViewModel[];
};

function statusLabel(status: SerializedOrderDetails["status"]) {
	return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

function lineTotal(unitPrice: string, quantity: number) {
	// Whole paise, the same arithmetic as the invoice model, so the two never disagree.
	return (Math.round(Number(unitPrice) * 100) * quantity) / 100;
}

function buildOrderViewModel(order: SerializedOrderDetails): OrderViewModel {
	const customerName = order.customerName?.trim();
	const totalItems = order.orderItems.reduce((total, item) => total + item.quantity, 0);
	const itemLabels = order.orderItems.map((item) => {
		const name = item.comboName || item.dessert.name;
		return `${name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`;
	});
	const itemsSummary = itemLabels.join(", ");
	const moreItems = itemLabels.length - 1;

	return {
		source: order,
		id: order.id,
		orderLabel: `#${order.id}`,
		customerName: customerName || "Walk-in",
		isWalkInCustomer: !customerName,
		createdAtTimestamp: new Date(order.createdAt).getTime(),
		timeLabel: formatTime(order.createdAt),
		status: order.status,
		statusLabel: statusLabel(order.status),
		isCancelled: order.status === "cancelled",
		totalItems,
		itemsLabel: formatCount(totalItems, "items"),
		itemsSummary,
		firstItemLabel: itemLabels[0] ?? "",
		moreItemsLabel: moreItems > 0 ? `+${formatNumber(moreItems)} more` : null,
		totalLabel: formatINR(order.total),
		deliveryCostLabel: Number(order.deliveryCost) > 0 ? formatINR(order.deliveryCost) : null,
		lines: order.orderItems.map((item) => ({
			id: item.id,
			name: item.comboName || item.dessert.name,
			baseDessertName: item.comboName ? item.dessert.name : null,
			quantity: item.quantity,
			lineTotalLabel: formatINR(lineTotal(item.unitPrice, item.quantity)),
			isCombo: Boolean(item.comboName),
			modifiers: item.modifiers.map((modifier) => ({
				id: modifier.id,
				name: modifier.dessert.name,
				quantity: modifier.quantity,
			})),
		})),
	};
}

export function buildOrdersViewModel(orders: SerializedOrders): OrdersViewModel {
	const normalizedOrders = orders.map(buildOrderViewModel).sort((a, b) => b.createdAtTimestamp - a.createdAtTimestamp);
	const itemsSold = orders.reduce(
		(total, order) =>
			order.status === "cancelled"
				? total
				: total + order.orderItems.reduce((orderTotal, item) => orderTotal + item.quantity, 0),
		0,
	);

	return {
		totalOrders: orders.length,
		itemsSold,
		orders: normalizedOrders,
	};
}
