import { describe, expect, it } from "vitest";
import { getClosedAnalyticsDays } from "@/lib/analytics-jobs";

const SCHEDULED_INSTANT = new Date("2026-07-14T18:40:00.000Z");

function dayKeys(days: readonly Date[]) {
	return days.map((day) => day.toISOString().slice(0, 10));
}

describe("getClosedAnalyticsDays", () => {
	it("returns the previous seven closed IST analytics days in ascending order", () => {
		const days = dayKeys(getClosedAnalyticsDays(SCHEDULED_INSTANT));

		expect(days).toEqual([
			"2026-07-08",
			"2026-07-09",
			"2026-07-10",
			"2026-07-11",
			"2026-07-12",
			"2026-07-13",
			"2026-07-14",
		]);
		expect(days).not.toContain("2026-07-15");
	});

	it("returns only the previous closed day for a one-day window", () => {
		expect(dayKeys(getClosedAnalyticsDays(SCHEDULED_INSTANT, 1))).toEqual(["2026-07-14"]);
	});
});
