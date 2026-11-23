import type { Area } from "@/features/access/area";
import {
	canBrowsePastDays,
	canCancelOn,
	type DayOrders,
	type OrderLineRecord,
	type OrderRecord,
	WALK_IN_CUSTOMER,
} from "@/features/orders/contract";
import { isSale, ORDER_STATUS, type OrderStatus } from "@/features/orders/sale";
import { formatCount, formatINR, formatNumber, formatOrderNumber, formatTime, UNIT } from "@/lib/format";
import { rupees, toCents } from "@/lib/money";
import type { DayKey } from "@/lib/shop-calendar";

const STATUS_LABEL: Record<OrderStatus, string> = {
	pending: "Pending",
	completed: "Completed",
	cancelled: "Cancelled",
};

/** Only admins see the day's revenue on the Orders page. */
export const ORDERS_SHOW_REVENUE: Record<Area, boolean> = { admin: true, manager: false };

/** The day an area's Orders page shows: the picked day where the area may browse, otherwise today. */
export function shownDay(area: Area, picked: DayKey | null, today: DayKey): DayKey {
	return canBrowsePastDays(area) ? (picked ?? today) : today;
}

function quantityLabel(name: string, quantity: number) {
	return quantity > 1 ? `${name} ×${quantity}` : name;
}

export type OrderLineView = {
	id: number;
	name: string;
	isCombo: boolean;
	/** A combo's base dessert then its add-ons (`Ice Cream ×2`); a dessert's add-ons. */
	contents: string[];
	quantity: number;
	unitPriceCents: number;
	lineTotalCents: number;
	lineTotalLabel: string;
};

export type OrderView = {
	id: number;
	orderLabel: string;
	customerName: string;
	isWalkInCustomer: boolean;
	createdAt: string;
	timeLabel: string;
	status: OrderStatus;
	statusLabel: string;
	isCancelled: boolean;
	totalItems: number;
	/** `5 items`, `1 item`. */
	itemsLabel: string;
	/** The first line on its own (`Rocky Road Brownie ×2`), so a row stays recognisable. */
	firstItemLabel: string;
	/** `+4 more` when the order has other lines, else null. */
	moreItemsLabel: string | null;
	subtotalCents: number;
	deliveryCents: number;
	totalCents: number;
	totalLabel: string;
	deliveryCostLabel: string | null;
	lines: OrderLineView[];
};

export type OrdersView = {
	totalOrders: number;
	itemsSold: number;
	revenueLabel: string;
	orders: OrderView[];
};

function lineView(line: OrderLineRecord): OrderLineView {
	const name = line.comboName || line.dessertName;
	const modifiers = line.modifiers.map((modifier) => quantityLabel(modifier.name, modifier.quantity));
	const unitPriceCents = toCents(line.unitPrice);
	const lineTotalCents = unitPriceCents * line.quantity;
	return {
		id: line.id,
		name,
		isCombo: Boolean(line.comboName),
		contents: line.comboName ? [line.dessertName, ...modifiers] : modifiers,
		quantity: line.quantity,
		unitPriceCents,
		lineTotalCents,
		lineTotalLabel: formatINR(rupees(lineTotalCents)),
	};
}

function orderView(order: OrderRecord): OrderView {
	const customerName = order.customerName?.trim();
	const lines = order.lines.map(lineView);
	const totalItems = lines.reduce((total, line) => total + line.quantity, 0);
	const deliveryCents = toCents(order.deliveryCost);
	const totalCents = toCents(order.total);
	const itemLabels = lines.map((line) => quantityLabel(line.name, line.quantity));
	const moreItems = itemLabels.length - 1;

	return {
		id: order.id,
		orderLabel: formatOrderNumber(order.id),
		customerName: customerName || WALK_IN_CUSTOMER,
		isWalkInCustomer: !customerName,
		createdAt: order.createdAt,
		timeLabel: formatTime(order.createdAt),
		status: order.status,
		statusLabel: STATUS_LABEL[order.status],
		isCancelled: order.status === ORDER_STATUS.cancelled,
		totalItems,
		itemsLabel: formatCount(totalItems, UNIT.item),
		firstItemLabel: itemLabels[0] ?? "",
		moreItemsLabel: moreItems > 0 ? `+${formatNumber(moreItems)} more` : null,
		subtotalCents: lines.reduce((total, line) => total + line.lineTotalCents, 0),
		deliveryCents,
		totalCents,
		totalLabel: formatINR(rupees(totalCents)),
		deliveryCostLabel: deliveryCents > 0 ? formatINR(rupees(deliveryCents)) : null,
		lines,
	};
}

/** A day's orders in the order given, with its summary: every order counts in Orders; only sales in Items sold and Revenue. */
function ordersView(orders: readonly OrderRecord[]): OrdersView {
	const views = orders.map(orderView);
	const sales = views.filter(isSale);
	return {
		totalOrders: views.length,
		itemsSold: sales.reduce((total, order) => total + order.totalItems, 0),
		revenueLabel: formatINR(rupees(sales.reduce((total, order) => total + order.totalCents, 0))),
		orders: views,
	};
}

/** The Orders page for one day's query: loading, failed with nothing to show, or its orders. */
export type DayOrdersScreen =
	| { status: "loading" }
	| { status: "failed" }
	| {
			status: "ready";
			orders: OrdersView;
			isToday: boolean;
			cancellable: boolean;
			/** The latest refresh failed, so the orders shown may be out of date. */
			refreshFailed: boolean;
	  };

export function dayOrdersScreen(query: {
	data: DayOrders | undefined;
	isPending: boolean;
	isFetching: boolean;
	isPlaceholderData: boolean;
	isRefetchError: boolean;
}): DayOrdersScreen {
	// A newly picked day shows the previous day as placeholder data while it loads; that is still loading.
	if (query.isPending || (query.isFetching && query.isPlaceholderData)) return { status: "loading" };
	if (!query.data) return { status: "failed" };
	const { day, today, orders } = query.data;
	return {
		status: "ready",
		orders: ordersView(orders),
		isToday: day === today,
		cancellable: canCancelOn(day, today),
		refreshFailed: query.isRefetchError,
	};
}
