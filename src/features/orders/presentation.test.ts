import { keepPreviousData, QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { DayOrders, OrderRecord } from "@/features/orders/contract";
import { dayOrdersScreen, shownDay } from "@/features/orders/presentation";

function order(overrides: Partial<OrderRecord> = {}): OrderRecord {
	return {
		id: 1,
		customerName: "",
		createdAt: "2026-07-17T13:31:00.000Z",
		deliveryCost: "0.00",
		total: "180.00",
		status: "completed",
		lines: [
			{
				id: 11,
				dessertName: "Ragi Fudge Brownie",
				comboName: null,
				quantity: 2,
				unitPrice: "90.00",
				modifiers: [],
			},
		],
		...overrides,
	};
}

/** The Orders page's view of a loaded day holding `orders`. */
function ordersView(orders: OrderRecord[]) {
	const screen = dayOrdersScreen({
		data: { day: "2026-07-17", today: "2026-07-17", orders },
		isPending: false,
		isFetching: false,
		isPlaceholderData: false,
		isRefetchError: false,
	});
	if (screen.status !== "ready") throw new Error(`The day is ${screen.status}`);
	return screen.orders;
}

function orderView(record: OrderRecord) {
	return ordersView([record]).orders[0];
}

describe("orders view", () => {
	it("labels each order for display", () => {
		const { orders } = ordersView([
			order({ id: 2, customerName: " Asha ", createdAt: "2026-07-17T14:00:00.000Z" }),
			order({ id: 1, createdAt: "2026-07-17T12:00:00.000Z" }),
		]);

		expect(orders[0]).toMatchObject({
			customerName: "Asha",
			isWalkInCustomer: false,
			orderLabel: "#2",
			totalItems: 2,
			firstItemLabel: "Ragi Fudge Brownie ×2",
			moreItemsLabel: null,
			totalLabel: "₹180",
			timeLabel: "7:30 PM",
			itemsLabel: "2 items",
			deliveryCostLabel: null,
			statusLabel: "Completed",
		});
		expect(orders[0]?.lines[0]).toMatchObject({ quantity: 2, unitPriceCents: 9_000, lineTotalLabel: "₹180" });
		expect(orders[1]).toMatchObject({ customerName: "Walk-in", isWalkInCustomer: true });
	});

	it("describes combos by their base dessert and add-ons, and adds up the amounts", () => {
		const view = orderView(
			order({
				deliveryCost: "40.00",
				total: "400.50",
				lines: [
					{
						id: 12,
						dessertName: "Chocolate Muffin",
						comboName: "Muffin Party Box",
						quantity: 2,
						unitPrice: "180.25",
						modifiers: [{ id: 22, name: "Nutella Blondie", quantity: 2 }],
					},
				],
			}),
		);

		expect(view).toMatchObject({
			firstItemLabel: "Muffin Party Box ×2",
			deliveryCostLabel: "₹40",
			subtotalCents: 36_050,
			deliveryCents: 4_000,
			totalCents: 40_050,
		});
		expect(view.lines[0]).toMatchObject({
			name: "Muffin Party Box",
			isCombo: true,
			contents: ["Chocolate Muffin", "Nutella Blondie ×2"],
			lineTotalCents: 36_050,
		});
	});

	it("names the first line on its own and counts the other lines", () => {
		const [line] = order().lines;
		const view = orderView(
			order({
				lines: [
					{ ...line, id: 31, quantity: 1, dessertName: "Couverture Chocolate Fudge Brownie" },
					{ ...line, id: 32, quantity: 3 },
					{ ...line, id: 33, quantity: 1, dessertName: "Vanilla Blondie" },
				],
			}),
		);

		expect(view.firstItemLabel).toBe("Couverture Chocolate Fudge Brownie");
		expect(view.moreItemsLabel).toBe("+2 more");
		expect(view.itemsLabel).toBe("5 items");
	});

	it("counts every order but only completed ones as sales, delivery included like Insights", () => {
		const model = ordersView([
			order({ id: 1, total: "280.00", deliveryCost: "40.00" }),
			order({ id: 2, total: "100.50" }),
			order({ id: 3, status: "cancelled", total: "500.00" }),
		]);

		expect(model.totalOrders).toBe(3);
		expect(model.itemsSold).toBe(4);
		expect(model.revenueLabel).toBe("₹380.50");
		expect(model.orders.find(({ id }) => id === 3)).toMatchObject({ isCancelled: true, statusLabel: "Cancelled" });
		expect(ordersView([order({ status: "cancelled" })])).toMatchObject({ itemsSold: 0, revenueLabel: "₹0" });
	});

	it("refuses amounts that are not two-decimal rupees", () => {
		expect(() => orderView(order({ total: "1.234" }))).toThrow("Invalid amount");
		expect(() => orderView(order({ total: "-1.50" }))).toThrow("Invalid amount");
	});
});

describe("the day an Orders page shows", () => {
	it("is the picked day for admins and always today for managers", () => {
		expect(shownDay("admin", "2026-07-10", "2026-07-17")).toBe("2026-07-10");
		expect(shownDay("admin", null, "2026-07-17")).toBe("2026-07-17");
		expect(shownDay("manager", "2026-07-10", "2026-07-17")).toBe("2026-07-17");
	});
});

describe("the Orders page for a day's query", () => {
	const yesterday: DayOrders = { day: "2026-07-16", today: "2026-07-17", orders: [order()] };

	function observe(queryFn: (day: string) => Promise<DayOrders>) {
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const options = (day: string) => ({
			queryKey: ["orders", day],
			queryFn: () => queryFn(day),
			placeholderData: keepPreviousData,
		});
		const observer = new QueryObserver<DayOrders>(client, options(yesterday.day));
		const unsubscribe = observer.subscribe(() => undefined);
		return {
			observer,
			showDay: (day: string) => observer.setOptions(options(day)),
			screen: () => dayOrdersScreen(observer.getCurrentResult()),
			unsubscribe,
		};
	}

	it("shows a day that failed to load as failed, not as a day without orders", async () => {
		const page = observe(async (day) => {
			if (day === yesterday.day) return yesterday;
			throw new Error("GET /api/orders failed (500)");
		});
		await vi.waitFor(() => expect(page.screen().status).toBe("ready"));

		page.showDay(yesterday.today);
		expect(page.screen().status).toBe("loading");
		await vi.waitFor(() => expect(page.screen().status).toBe("failed"));
		page.unsubscribe();
	});

	it("keeps the loaded orders when a refresh fails, and says so", async () => {
		const read = vi.fn().mockResolvedValueOnce(yesterday).mockRejectedValue(new Error("offline"));
		const page = observe(read);
		await vi.waitFor(() => expect(page.screen()).toMatchObject({ status: "ready", refreshFailed: false }));

		await page.observer.refetch();

		expect(page.screen()).toMatchObject({ status: "ready", refreshFailed: true, orders: { totalOrders: 1 } });
		page.unsubscribe();
	});
});
