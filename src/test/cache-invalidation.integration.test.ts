import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyticsDailyRevenueTable, analyticsMonthlyRevenueTable, dessertsTable } from "@/db/schema";
import { closeIntegrationDatabase, integrationDb, resetIntegrationData } from "@/test/integration/database";
import { createTaggedCache } from "@/test/integration/tagged-cache";
import { mockStaffSessions, signedInAs } from "@/test/staff-session";

const cache = createTaggedCache();
vi.doMock("server-only", () => ({}));
vi.doMock("@/db", () => ({ db: integrationDb }));
mockStaffSessions();
vi.doMock("next/cache", () => cache.nextCache);

const admin = { id: "cache-admin", area: "admin" } as const;
const reporting = await import("@/features/insights/reporting");
const getDashboardReport = signedInAs(admin, reporting.getDashboardReport);
const getAnalyticsOverview = signedInAs(admin, reporting.getAnalyticsOverview);
const getBusinessWeekRevenue = signedInAs(admin, reporting.getBusinessWeekRevenue);
const orderActions = await import("@/features/orders/actions");
const createOrder = signedInAs(admin, orderActions.createOrder);
const cancelOrder = signedInAs(admin, orderActions.cancelOrder);
const getDayOrders = signedInAs(admin, (await import("@/features/orders/queries")).getDayOrders);
const { CacheTag } = await import("@/lib/cache-tags");
const NOW = new Date("2026-07-15T12:00:00Z");
const CLOSED_DAY = new Date("2026-07-14T00:00:00Z");
const readOrders = async (day: string) => (await getDayOrders(day)).orders;

beforeEach(async () => {
	cache.clear();
	await resetIntegrationData();
	vi.useFakeTimers({ toFake: ["Date"], now: NOW });
});
afterEach(() => vi.useRealTimers());
afterAll(closeIntegrationDatabase);

describe("cache invalidation", () => {
	it("refreshes live orders and reports on create/cancel while preserving closed reports until compilation", async () => {
		const [dessert] = await integrationDb
			.insert(dessertsTable)
			.values({
				name: "Cache Dessert",
				price: 100,
				hasUnlimitedStock: true,
			})
			.returning();
		await integrationDb
			.insert(analyticsDailyRevenueTable)
			.values({ day: CLOSED_DAY, grossRevenue: "50.00", orderCount: 1 });
		await integrationDb
			.insert(analyticsMonthlyRevenueTable)
			.values({ month: "2026-06", grossRevenue: "100.00", orderCount: 1 });

		expect((await getDashboardReport("2026-07-15")).totals.revenue).toBe(0);
		expect(await readOrders("2026-07-15")).toEqual([]);
		expect(await readOrders("2026-07-14")).toEqual([]);
		expect((await getDashboardReport("2026-07-14")).totals.revenue).toBe(50);
		expect((await getAnalyticsOverview()).months[0].revenue).toBe(100);
		expect((await getBusinessWeekRevenue("2026-07")).reduce((sum, week) => sum + week.revenue, 0)).toBe(50);

		// Changed aggregate rows become visible only when the compiler invalidates them.
		await integrationDb.update(analyticsDailyRevenueTable).set({ grossRevenue: "75.00" });
		await integrationDb.update(analyticsMonthlyRevenueTable).set({ grossRevenue: "200.00" });
		const closedOrders = await readOrders("2026-07-14");
		const saved = await createOrder({
			submissionId: "00000000-0000-4000-8000-00000000cac4",
			customerName: "Cache test",
			deliveryCost: "0.00",
			lines: [{ baseDessertId: dessert.id, quantity: 1 }],
		});
		if (!saved.ok) throw new Error(saved.error);

		expect((await readOrders("2026-07-15")).map((order) => order.id)).toEqual([saved.data.orderId]);
		expect(await readOrders("2026-07-14")).toBe(closedOrders);
		expect((await getDashboardReport("2026-07-15")).totals.revenue).toBe(100);
		expect((await getBusinessWeekRevenue("2026-07")).reduce((sum, week) => sum + week.revenue, 0)).toBe(50);
		expect((await getDashboardReport("2026-07-14")).totals.revenue).toBe(50);
		expect((await getAnalyticsOverview()).months[0].revenue).toBe(100);

		await cancelOrder(saved.data.orderId);
		expect((await readOrders("2026-07-15"))[0].status).toBe("cancelled");
		expect((await getDashboardReport("2026-07-15")).totals.revenue).toBe(0);
		expect((await getDashboardReport("2026-07-14")).totals.revenue).toBe(50);

		cache.invalidate(CacheTag.analytics);
		expect((await getDashboardReport("2026-07-14")).totals.revenue).toBe(75);
		expect((await getAnalyticsOverview()).months[0].revenue).toBe(200);
		expect((await getBusinessWeekRevenue("2026-07")).reduce((sum, week) => sum + week.revenue, 0)).toBe(75);
		cache.invalidate(CacheTag.orders);
		expect(await readOrders("2026-07-14")).not.toBe(closedOrders);
	});

	it("switches a cached live day to compiled data at IST midnight", async () => {
		expect((await getDashboardReport("2026-07-15")).totals.revenue).toBe(0);
		vi.setSystemTime(new Date("2026-07-15T18:30:00Z"));
		await integrationDb.insert(analyticsDailyRevenueTable).values({
			day: new Date("2026-07-15T00:00:00Z"),
			grossRevenue: "321.00",
			orderCount: 3,
		});
		expect((await getDashboardReport("2026-07-15")).totals.revenue).toBe(321);
	});
});
