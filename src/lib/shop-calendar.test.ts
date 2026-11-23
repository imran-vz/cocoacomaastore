import { describe, expect, it } from "vitest";
import {
	addDays,
	addMonths,
	analyticsDate,
	dayEnd,
	dayKeyOf,
	dayKeyOfAnalyticsDate,
	dayStart,
	daysBetween,
	monthEnd,
	monthKeyOf,
	monthLastDay,
	monthStart,
	parseDayKey,
	parseMonthKey,
	shopParts,
} from "@/lib/shop-calendar";

describe("shop days", () => {
	it("starts a shop day at IST midnight, 18:30 UTC the evening before", () => {
		expect(dayKeyOf(new Date("2026-07-14T18:29:59.999Z"))).toBe("2026-07-14");
		expect(dayKeyOf(new Date("2026-07-14T18:30:00.000Z"))).toBe("2026-07-15");
		expect(monthKeyOf(new Date("2026-07-31T18:30:00.000Z"))).toBe("2026-08");
	});

	it("turns a shop day into the instants it starts and ends", () => {
		expect(dayStart("2026-07-15").toISOString()).toBe("2026-07-14T18:30:00.000Z");
		expect(dayEnd("2026-07-15").toISOString()).toBe("2026-07-15T18:30:00.000Z");
		expect(dayEnd("2026-12-31")).toEqual(dayStart("2027-01-01"));
	});

	it("parses only real calendar days and months", () => {
		expect(parseDayKey("2026-02-28")).toBe("2026-02-28");
		expect(parseDayKey("2026-02-30")).toBeNull();
		expect(parseDayKey("2026-2-3")).toBeNull();
		expect(parseDayKey(null)).toBeNull();
		expect(parseMonthKey("2026-12")).toBe("2026-12");
		expect(parseMonthKey("2026-13")).toBeNull();
		expect(parseMonthKey("2026-00")).toBeNull();
	});

	it("steps across month and year ends", () => {
		expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
		expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
		expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
		expect(addMonths("2026-01", -1)).toBe("2025-12");
		expect(addMonths("2026-12", 1)).toBe("2027-01");
	});

	it("lists a month's days and the days of a range", () => {
		expect(monthLastDay("2028-02")).toBe("2028-02-29");
		expect(monthLastDay("2026-12")).toBe("2026-12-31");
		expect(daysBetween("2026-12-30", "2027-01-02")).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
		expect(daysBetween("2026-01-02", "2026-01-01")).toEqual([]);
	});

	it("reads an instant's shop-time fields", () => {
		expect(shopParts(new Date("2026-12-31T18:45:00.000Z"))).toEqual({
			year: 2027,
			month: 1,
			day: 1,
			weekday: 5,
			hour: 0,
			minute: 15,
		});
	});

	it("bounds a shop month by IST midnights", () => {
		expect(monthStart("2026-03").toISOString()).toBe("2026-02-28T18:30:00.000Z");
		expect(monthEnd("2026-12").toISOString()).toBe("2026-12-31T18:30:00.000Z");
		expect(monthEnd("2026-02")).toEqual(monthStart("2026-03"));
	});

	it("round-trips a shop day through the analytics day columns", () => {
		for (const day of ["2026-01-01", "2026-07-15", "2028-02-29", "2026-12-31"]) {
			expect(dayKeyOfAnalyticsDate(analyticsDate(day))).toBe(day);
		}
	});
});
