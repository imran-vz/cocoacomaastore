import { describe, expect, it } from "vitest";
import { buildHourSlots } from "@/features/insights/hourly-sales";

describe("buildHourSlots", () => {
	it("returns nothing for a day without completed orders", () => {
		expect(buildHourSlots([])).toEqual([]);
		expect(buildHourSlots([{ createdAt: "2026-10-30T08:00:00.000Z", status: "cancelled", total: "100.00" }])).toEqual(
			[],
		);
	});

	it("buckets orders by shop-time hour", () => {
		const slots = buildHourSlots([
			{ createdAt: "2026-10-30T08:29:59.000Z", status: "completed", total: "10" }, // 1:59 PM IST
			{ createdAt: "2026-10-30T08:30:00.000Z", status: "completed", total: "20" }, // 2:00 PM IST
		]);
		expect(slots.find((slot) => slot.hour === 13)).toMatchObject({ revenue: 10, orders: 1, axisLabel: "1 PM" });
		expect(slots.find((slot) => slot.hour === 14)).toMatchObject({ revenue: 20, orders: 1, axisLabel: "2 PM" });
	});

	it("sums completed orders per hour and keeps quiet hours in between", () => {
		const slots = buildHourSlots([
			{ createdAt: "2026-10-30T08:40:00.000Z", status: "completed", total: "100.00" }, // 2 PM
			{ createdAt: "2026-10-30T08:50:00.000Z", status: "completed", total: "50.50" }, // 2 PM
			{ createdAt: "2026-10-30T08:55:00.000Z", status: "cancelled", total: "999.00" },
			{ createdAt: "2026-10-30T17:00:00.000Z", status: "completed", total: "200" }, // 10 PM
		]);
		expect(slots.map((slot) => slot.hour)).toEqual([14, 15, 16, 17, 18, 19, 20, 21, 22]);
		expect(slots[0]).toMatchObject({ revenue: 150.5, orders: 2 });
		expect(slots[1]).toMatchObject({ revenue: 0, orders: 0 });
		expect(slots.at(-1)).toMatchObject({ revenue: 200, orders: 1 });
	});

	it("widens a short day to eight hours without leaving the day", () => {
		const late = buildHourSlots([{ createdAt: "2026-10-30T18:00:00.000Z", status: "completed", total: "10" }]); // 11:30 PM
		expect(late.map((slot) => slot.hour)).toEqual([16, 17, 18, 19, 20, 21, 22, 23]);
		const early = buildHourSlots([{ createdAt: "2026-11-22T19:00:00.000Z", status: "completed", total: "10" }]); // 12:30 AM
		expect(early.map((slot) => slot.hour)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
	});
});
