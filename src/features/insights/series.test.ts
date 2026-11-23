import { describe, expect, it } from "vitest";
import { businessWeeks, dayTrend, monthTrend } from "@/features/insights/series";

describe("businessWeeks", () => {
	it("splits a month into Tuesday–Sunday weeks clipped to the month", () => {
		// November 2026 starts on a Sunday and ends on a Monday.
		const weeks = businessWeeks("2026-11", new Map());

		expect(weeks.map(({ index, firstDay, lastDay }) => [index, firstDay, lastDay])).toEqual([
			[1, "2026-11-01", "2026-11-01"],
			[2, "2026-11-03", "2026-11-08"],
			[3, "2026-11-10", "2026-11-15"],
			[4, "2026-11-17", "2026-11-22"],
			[5, "2026-11-24", "2026-11-29"],
		]);
	});

	it("sums each week's days and leaves Monday sales out", () => {
		const weeks = businessWeeks(
			"2026-11",
			new Map([
				["2026-11-01", { revenue: 100, orders: 1 }],
				["2026-11-02", { revenue: 999, orders: 9 }], // Monday
				["2026-11-03", { revenue: 50, orders: 2 }],
				["2026-11-08", { revenue: 25, orders: 1 }],
				["2026-11-30", { revenue: 999, orders: 9 }], // Monday
			]),
		);

		expect(weeks.map(({ revenue, orders }) => ({ revenue, orders }))).toEqual([
			{ revenue: 100, orders: 1 },
			{ revenue: 75, orders: 3 },
			{ revenue: 0, orders: 0 },
			{ revenue: 0, orders: 0 },
			{ revenue: 0, orders: 0 },
		]);
	});
});

describe("dayTrend", () => {
	it("returns the seven days ending on the day, zero-filled, across a month boundary", () => {
		const trend = dayTrend("2026-11-03", new Map([["2026-10-30", { revenue: 40, orders: 2 }]]));

		expect(trend.map((point) => point.day)).toEqual([
			"2026-10-28",
			"2026-10-29",
			"2026-10-30",
			"2026-10-31",
			"2026-11-01",
			"2026-11-02",
			"2026-11-03",
		]);
		expect(trend[2]).toEqual({ day: "2026-10-30", revenue: 40, orders: 2 });
		expect(trend[3]).toEqual({ day: "2026-10-31", revenue: 0, orders: 0 });
	});
});

describe("monthTrend", () => {
	it("fills quiet months between the first and latest month", () => {
		const trend = monthTrend([
			{ month: "2026-09", revenue: 300, orders: 3 },
			{ month: "2026-07", revenue: 100, orders: 1 },
		]);

		expect(trend).toEqual([
			{ month: "2026-07", revenue: 100, orders: 1 },
			{ month: "2026-08", revenue: 0, orders: 0 },
			{ month: "2026-09", revenue: 300, orders: 3 },
		]);
	});

	it("keeps twelve months ending on the latest month when the data spans longer", () => {
		const trend = monthTrend([
			{ month: "2025-01", revenue: 1, orders: 1 },
			{ month: "2026-09", revenue: 2, orders: 1 },
		]);

		expect(trend).toHaveLength(12);
		expect(trend[0].month).toBe("2025-10");
		expect(trend.at(-1)?.month).toBe("2026-09");
	});

	it("is empty without compiled months", () => {
		expect(monthTrend([])).toEqual([]);
	});
});
