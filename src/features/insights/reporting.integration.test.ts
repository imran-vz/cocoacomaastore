import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	analyticsDailyRevenueTable,
	dessertsTable,
	inventoryAuditLogTable,
	orderItemModifiersTable,
	orderItemsTable,
	ordersTable,
} from "@/db/schema";
import { analyticsDate, dayEnd, dayStart } from "@/lib/shop-calendar";
import {
	closeIntegrationDatabase,
	integrationDatabaseLayer,
	integrationDb,
	resetIntegrationData,
} from "@/test/integration/database";
import { mockStaffSessions, signedInAs } from "@/test/staff-session";

const FIXED_NOW = new Date("2026-07-15T12:00:00.000Z");
const TODAY = "2026-07-15";
let orderSequence = 0;

vi.doMock("server-only", () => ({}));
vi.doMock("@/db", () => ({ db: integrationDb }));
mockStaffSessions();
vi.doMock("next/cache", () => ({
	unstable_cache: (callback: () => unknown) => callback,
	revalidatePath: vi.fn(),
	revalidateTag: vi.fn(),
	updateTag: vi.fn(),
}));

const getDashboardReport = signedInAs(
	{ id: "integration-admin", area: "admin" },
	(await import("@/features/insights/reporting")).getDashboardReport,
);
const { recomputeDay } = await import("@/features/insights/compile");

async function seedDessert(name = "Reporting Dessert", kind: "base" | "modifier" = "base") {
	const [dessert] = await integrationDb.insert(dessertsTable).values({ name, price: 100, kind }).returning();
	return dessert;
}

async function seedOrder({
	dessertId,
	createdAt,
	status = "completed",
	isDeleted = false,
	total,
	quantity,
	modifier,
}: {
	dessertId: number;
	createdAt: Date;
	status?: "pending" | "completed" | "cancelled";
	isDeleted?: boolean;
	total: string;
	quantity: number;
	modifier?: { dessertId: number; quantity: number };
}) {
	orderSequence += 1;
	const [order] = await integrationDb
		.insert(ordersTable)
		.values({
			submissionId: `reporting-order-${orderSequence}`,
			requestFingerprint: orderSequence.toString(16).padStart(64, "0"),
			customerName: "Reporting",
			createdAt,
			deliveryCost: "0.00",
			total,
			status,
			isDeleted,
		})
		.returning();
	const [item] = await integrationDb
		.insert(orderItemsTable)
		.values({
			orderId: order.id,
			dessertId,
			baseDessertName: "Reporting Dessert",
			inventoryDeducted: false,
			quantity,
			unitPrice: total,
		})
		.returning();
	if (modifier) {
		await integrationDb.insert(orderItemModifiersTable).values({
			orderItemId: item.id,
			dessertId: modifier.dessertId,
			dessertName: "Topping",
			quantity: modifier.quantity,
		});
	}
	return order;
}

describe("Insights day report", () => {
	beforeEach(async () => {
		await resetIntegrationData();
		vi.useFakeTimers({ toFake: ["Date"], now: FIXED_NOW });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	afterAll(async () => {
		await closeIntegrationDatabase();
	});

	it("reads today live even when a compiled row for today exists", async () => {
		const dessert = await seedDessert();
		const start = dayStart(TODAY);
		const end = dayEnd(TODAY);
		await integrationDb.insert(analyticsDailyRevenueTable).values({
			day: analyticsDate(TODAY),
			grossRevenue: "9999.00",
			orderCount: 99,
		});
		const [firstOrder] = await Promise.all([
			seedOrder({ dessertId: dessert.id, createdAt: start, total: "100.00", quantity: 1 }),
			seedOrder({ dessertId: dessert.id, createdAt: new Date(end.getTime() - 1), total: "200.00", quantity: 2 }),
			seedOrder({
				dessertId: dessert.id,
				createdAt: new Date(start.getTime() + 1),
				status: "cancelled",
				total: "300.00",
				quantity: 3,
			}),
			seedOrder({
				dessertId: dessert.id,
				createdAt: new Date(start.getTime() + 2),
				isDeleted: true,
				total: "400.00",
				quantity: 4,
			}),
			seedOrder({ dessertId: dessert.id, createdAt: new Date(start.getTime() - 1), total: "500.00", quantity: 5 }),
			seedOrder({ dessertId: dessert.id, createdAt: end, total: "600.00", quantity: 6 }),
		]);

		const report = await getDashboardReport(TODAY);

		expect(report.isLive).toBe(true);
		expect(report.totals).toEqual({ orders: 2, revenue: 300, itemsSold: 3 });
		expect(report.trend.at(-1)).toEqual({ day: TODAY, orders: 2, revenue: 300 });

		await integrationDb.update(ordersTable).set({ status: "cancelled" }).where(eq(ordersTable.id, firstOrder.id));
		const updated = await getDashboardReport(TODAY);
		expect(updated.totals).toEqual({ orders: 1, revenue: 200, itemsSold: 2 });
	});

	it("returns the whole week ending on the day, with closed days from compiled rows", async () => {
		await integrationDb.insert(analyticsDailyRevenueTable).values({
			day: analyticsDate("2026-07-10"),
			grossRevenue: "75.00",
			orderCount: 3,
		});

		const report = await getDashboardReport(TODAY);

		expect(report.trend.map((point) => point.day)).toEqual([
			"2026-07-09",
			"2026-07-10",
			"2026-07-11",
			"2026-07-12",
			"2026-07-13",
			"2026-07-14",
			"2026-07-15",
		]);
		expect(report.trend[1]).toEqual({ day: "2026-07-10", revenue: 75, orders: 3 });
		expect(report.trend[2]).toEqual({ day: "2026-07-11", revenue: 0, orders: 0 });
	});

	it("lists the latest 50 changes to the day's stock, counting every change the list could show", async () => {
		const dessert = await seedDessert();
		const change = (day: string, createdAt: Date, newQuantity: number, dessertId: number | null = dessert.id) => ({
			day: analyticsDate(day),
			dessertId,
			action: "manual_adjustment" as const,
			previousQuantity: 0,
			newQuantity,
			createdAt,
		});
		await integrationDb
			.insert(inventoryAuditLogTable)
			.values([
				...Array.from({ length: 51 }, (_, index) => change(TODAY, new Date(dayStart(TODAY).getTime() + index), index)),
				change(TODAY, dayEnd(TODAY), 99),
				change("2026-07-14", new Date(dayStart(TODAY).getTime() + 100), 1000),
				change(TODAY, dayEnd(TODAY), 2000, null),
			]);

		const { stockChanges } = await getDashboardReport(TODAY);

		expect(stockChanges.total).toBe(52);
		expect(stockChanges.entries).toHaveLength(50);
		expect(stockChanges.entries.map(({ newQuantity }) => newQuantity).slice(0, 2)).toEqual([99, 50]);
		expect(stockChanges.entries.some(({ newQuantity }) => newQuantity >= 1000)).toBe(false);
	});

	it("reports a closed day from compiled rows with the same items sold it had while live", async () => {
		const dessert = await seedDessert();
		const topping = await seedDessert("Topping", "modifier");
		const closedDay = "2026-07-14";
		await seedOrder({
			dessertId: dessert.id,
			createdAt: new Date(dayStart(closedDay).getTime() + 1),
			total: "150.00",
			quantity: 2,
			modifier: { dessertId: topping.id, quantity: 3 },
		});

		vi.setSystemTime(new Date("2026-07-14T12:00:00.000Z"));
		const whileLive = await getDashboardReport(closedDay);
		vi.setSystemTime(FIXED_NOW);
		await Effect.runPromise(recomputeDay(closedDay).pipe(Effect.provide(integrationDatabaseLayer)));
		await integrationDb.update(analyticsDailyRevenueTable).set({ grossRevenue: "175.00" });
		const closed = await getDashboardReport(closedDay);

		expect(whileLive.totals).toEqual({ orders: 1, revenue: 150, itemsSold: 2 });
		expect(closed.isLive).toBe(false);
		expect(closed.totals).toEqual({ orders: 1, revenue: 175, itemsSold: 2 });
	});
});
