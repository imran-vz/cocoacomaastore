import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyticsDailyRevenueTable, analyticsMonthlyRevenueTable, dessertsTable } from "@/db/schema";
import { closeIntegrationDatabase, integrationDb, resetIntegrationData } from "@/test/integration/database";

// Model tag eviction while keeping actual reporting queries and mutations on Postgres.
const entries = new Map<string, { value: unknown; tags: readonly string[] }>();
function invalidate(tag: string) {
	for (const [key, entry] of entries) {
		if (entry.tags.includes(tag)) entries.delete(key);
	}
}
vi.doMock("server-only", () => ({}));
vi.doMock("@/db", () => ({ db: integrationDb }));
vi.doMock("@/lib/auth/guards", () => ({ requireAdmin: vi.fn().mockResolvedValue({ id: "cache-admin" }) }));
vi.doMock("next/cache", () => ({
	unstable_cache:
		(callback: () => Promise<unknown>, keys: string[], options: { tags: readonly string[] }) => async () => {
			const key = JSON.stringify(keys);
			const cached = entries.get(key);
			if (cached) return cached.value;
			const value = await callback();
			entries.set(key, { value, tags: options.tags });
			return value;
		},
	updateTag: invalidate,
	revalidateTag: invalidate,
	revalidatePath: vi.fn(),
}));

const { getAdminDashboardReport, getAdminAnalyticsReport, getCachedWeeklyRevenue } = await import("./index");
const { createCompletedOrder, cancelOrderAsNormalPath, getCachedOrders } = await import("@/lib/order-lifecycle");
const { CacheTag } = await import("@/server/effect/cache-tags");
const NOW = new Date("2026-07-15T12:00:00Z");
const CLOSED_DAY = new Date("2026-07-14T00:00:00Z");

beforeEach(async () => {
	entries.clear();
	await resetIntegrationData();
	vi.useFakeTimers({ toFake: ["Date"], now: NOW });
});
afterEach(() => vi.useRealTimers());
afterAll(closeIntegrationDatabase);

describe("report cache invalidation", () => {
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

		expect((await getAdminDashboardReport("2026-07-15")).stats.dayRevenue).toBe(0);
		expect(await getCachedOrders()).toEqual([]);
		expect(await getCachedOrders(CLOSED_DAY)).toEqual([]);
		expect((await getAdminDashboardReport("2026-07-14")).stats.dayRevenue).toBe(50);
		expect((await getAdminAnalyticsReport()).monthlyRevenue[0].grossRevenue).toBe(100);
		expect((await getCachedWeeklyRevenue("2026-07")).reduce((sum, week) => sum + week.grossRevenue, 0)).toBe(50);

		// Changed aggregate rows become visible only when the compiler invalidates them.
		await integrationDb.update(analyticsDailyRevenueTable).set({ grossRevenue: "75.00" });
		await integrationDb.update(analyticsMonthlyRevenueTable).set({ grossRevenue: "200.00" });
		const closedOrders = await getCachedOrders(CLOSED_DAY);
		const saved = await createCompletedOrder(
			{
				submissionId: "cache-test-order",
				customerName: "Cache test",
				deliveryCost: "0.00",
				lines: [{ baseDessertId: dessert.id, quantity: 1 }],
			},
			"cache-admin",
		);

		expect((await getCachedOrders()).map((order) => order.id)).toEqual([saved.orderId]);
		expect(await getCachedOrders(CLOSED_DAY)).toBe(closedOrders);
		expect((await getAdminDashboardReport("2026-07-15")).stats.dayRevenue).toBe(100);
		expect((await getCachedWeeklyRevenue("2026-07")).reduce((sum, week) => sum + week.grossRevenue, 0)).toBe(175);
		expect((await getAdminDashboardReport("2026-07-14")).stats.dayRevenue).toBe(50);
		expect((await getAdminAnalyticsReport()).monthlyRevenue[0].grossRevenue).toBe(100);

		await cancelOrderAsNormalPath(saved.orderId, "cache-admin");
		expect((await getCachedOrders())[0].status).toBe("cancelled");
		expect((await getAdminDashboardReport("2026-07-15")).stats.dayRevenue).toBe(0);
		expect((await getAdminDashboardReport("2026-07-14")).stats.dayRevenue).toBe(50);

		invalidate(CacheTag.analytics);
		expect((await getAdminDashboardReport("2026-07-14")).stats.dayRevenue).toBe(75);
		expect((await getAdminAnalyticsReport()).monthlyRevenue[0].grossRevenue).toBe(200);
		invalidate(CacheTag.orders);
		expect(await getCachedOrders(CLOSED_DAY)).not.toBe(closedOrders);
	});

	it("switches a cached live day to compiled data and refreshes the weekly live day at IST midnight", async () => {
		expect((await getAdminDashboardReport("2026-07-15")).stats.dayRevenue).toBe(0);
		expect((await getCachedWeeklyRevenue("2026-07")).reduce((sum, week) => sum + week.grossRevenue, 0)).toBe(0);
		vi.setSystemTime(new Date("2026-07-15T18:30:00Z"));
		await integrationDb.insert(analyticsDailyRevenueTable).values({
			day: new Date("2026-07-15T00:00:00Z"),
			grossRevenue: "321.00",
			orderCount: 3,
		});
		expect((await getAdminDashboardReport("2026-07-15")).stats.dayRevenue).toBe(321);
		expect((await getCachedWeeklyRevenue("2026-07")).reduce((sum, week) => sum + week.grossRevenue, 0)).toBe(321);
	});
});
