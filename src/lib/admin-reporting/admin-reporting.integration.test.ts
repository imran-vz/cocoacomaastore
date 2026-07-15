import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	analyticsDailyDessertRevenueTable,
	analyticsDailyRevenueTable,
	dessertsTable,
	orderItemsTable,
	ordersTable,
} from "@/db/schema";
import { getAnalyticsDay, getEndOfDayIST, getStartOfDayIST } from "@/lib/ist-date";
import { recomputeDayAnalyticsEffect } from "@/lib/recompute-day-analytics";
import {
	closeIntegrationDatabase,
	integrationDatabaseLayer,
	integrationDb,
	resetIntegrationData,
} from "@/test/integration/database";

const FIXED_NOW = new Date("2026-07-15T12:00:00.000Z");

vi.doMock("server-only", () => ({}));
vi.doMock("@/db", () => ({ db: integrationDb }));
vi.doMock("@/lib/auth/guards", () => ({ requireAdmin: vi.fn().mockResolvedValue({ id: "integration-admin" }) }));
vi.doMock("next/cache", () => ({
	unstable_cache: (callback: () => unknown) => callback,
	revalidatePath: vi.fn(),
	revalidateTag: vi.fn(),
	updateTag: vi.fn(),
}));

const { getAdminDashboardReport } = await import("@/lib/admin-reporting");

async function seedDessert() {
	const [dessert] = await integrationDb
		.insert(dessertsTable)
		.values({ name: "Reporting Dessert", price: 100 })
		.returning();
	return dessert;
}

async function seedOrder({
	dessertId,
	createdAt,
	status = "completed",
	isDeleted = false,
	total,
	quantity,
}: {
	dessertId: number;
	createdAt: Date;
	status?: "pending" | "completed" | "cancelled";
	isDeleted?: boolean;
	total: string;
	quantity: number;
}) {
	const [order] = await integrationDb
		.insert(ordersTable)
		.values({ customerName: "Reporting", createdAt, deliveryCost: "0.00", total, status, isDeleted })
		.returning();
	await integrationDb.insert(orderItemsTable).values({
		orderId: order.id,
		dessertId,
		quantity,
		unitPrice: total,
	});
	return order;
}

describe("Admin reporting persistence", () => {
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

	it("includes only completed, active orders inside the current IST day", async () => {
		const dessert = await seedDessert();
		const start = getStartOfDayIST(FIXED_NOW);
		const end = getEndOfDayIST(FIXED_NOW);
		await Promise.all([
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

		const report = await getAdminDashboardReport("2026-07-15");

		expect(report.stats.dayOrdersCount).toBe(2);
		expect(report.stats.dayRevenue).toBe(300);
		expect(report.stats.dayItemsSold).toBe(3);
		expect(report.dailyRevenue.at(-1)).toMatchObject({ orders: 2, revenue: 300 });
	});

	it("compiles only completed, active orders inside the analytics day", async () => {
		const dessert = await seedDessert();
		const start = getStartOfDayIST(FIXED_NOW);
		const end = getEndOfDayIST(FIXED_NOW);
		await seedOrder({ dessertId: dessert.id, createdAt: new Date(start.getTime() + 1), total: "150.00", quantity: 2 });
		await seedOrder({
			dessertId: dessert.id,
			createdAt: new Date(start.getTime() + 2),
			status: "cancelled",
			total: "250.00",
			quantity: 3,
		});
		await seedOrder({
			dessertId: dessert.id,
			createdAt: new Date(start.getTime() + 3),
			isDeleted: true,
			total: "350.00",
			quantity: 4,
		});
		await seedOrder({ dessertId: dessert.id, createdAt: end, total: "450.00", quantity: 5 });

		await Effect.runPromise(recomputeDayAnalyticsEffect(FIXED_NOW).pipe(Effect.provide(integrationDatabaseLayer)));

		const [daily] = await integrationDb
			.select()
			.from(analyticsDailyRevenueTable)
			.where(eq(analyticsDailyRevenueTable.day, getAnalyticsDay(FIXED_NOW)));
		const [dessertDaily] = await integrationDb
			.select()
			.from(analyticsDailyDessertRevenueTable)
			.where(eq(analyticsDailyDessertRevenueTable.day, getAnalyticsDay(FIXED_NOW)));
		expect(daily).toMatchObject({ grossRevenue: "150.00", orderCount: 1 });
		expect(dessertDaily).toMatchObject({
			dessertId: dessert.id,
			grossRevenue: "300.00",
			quantitySold: 2,
			orderCount: 1,
		});
	});
});
