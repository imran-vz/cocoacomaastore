import type { SerializedOrderDetails, SerializedOrders } from "@/lib/order-lifecycle";

const IST_TIME_ZONE = "Asia/Kolkata";

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
	itemsSummary: string;
	totalLabel: string;
	deliveryCostLabel: string | null;
	lines: OrderLineViewModel[];
};

export type OrdersViewModel = {
	totalOrders: number;
	itemsSold: number;
	orders: OrderViewModel[];
};

function formatTime(date: string) {
	return new Date(date).toLocaleTimeString("en-IN", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
		timeZone: IST_TIME_ZONE,
	});
}

function statusLabel(status: SerializedOrderDetails["status"]) {
	return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

function moneyLabel(value: string) {
	return `₹${value}`;
}

function buildOrderViewModel(order: SerializedOrderDetails): OrderViewModel {
	const customerName = order.customerName?.trim();
	const totalItems = order.orderItems.reduce((total, item) => total + item.quantity, 0);
	const itemsSummary = order.orderItems
		.map((item) => {
			const name = item.comboName || item.dessert.name;
			return `${name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`;
		})
		.join(", ");

	return {
		source: order,
		id: order.id,
		orderLabel: `#${order.id}`,
		customerName: customerName || "Walk-in Customer",
		isWalkInCustomer: !customerName,
		createdAtTimestamp: new Date(order.createdAt).getTime(),
		timeLabel: formatTime(order.createdAt),
		status: order.status,
		statusLabel: statusLabel(order.status),
		isCancelled: order.status === "cancelled",
		totalItems,
		itemsSummary,
		totalLabel: moneyLabel(order.total),
		deliveryCostLabel: Number(order.deliveryCost) > 0 ? moneyLabel(order.deliveryCost) : null,
		lines: order.orderItems.map((item) => ({
			id: item.id,
			name: item.comboName || item.dessert.name,
			baseDessertName: item.comboName ? item.dessert.name : null,
			quantity: item.quantity,
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
