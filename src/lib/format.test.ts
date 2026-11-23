import { describe, expect, it } from "vitest";
import {
	formatBadgeCount,
	formatCount,
	formatDate,
	formatDateShort,
	formatDayShort,
	formatFullDate,
	formatHour,
	formatHourRange,
	formatINR,
	formatINRCompact,
	formatInitials,
	formatList,
	formatMonth,
	formatMonthRange,
	formatMonthShort,
	formatNumber,
	formatPercent,
	formatRelativeDay,
	formatSigned,
	formatTime,
} from "@/lib/format";

// 23 Nov 2026, 00:30 IST
const halfPastMidnightIST = new Date("2026-11-22T19:00:00.000Z");
// 23 Nov 2026, 16:05 IST
const afternoonIST = new Date("2026-11-23T10:35:00.000Z");

describe("formatINR", () => {
	it("drops paise for whole rupees and uses lakh grouping", () => {
		expect(formatINR(80)).toBe("₹80");
		expect(formatINR(7750)).toBe("₹7,750");
		expect(formatINR(1200882)).toBe("₹12,00,882");
		expect(formatINR("500.00")).toBe("₹500");
	});

	it("shows two decimals when there are paise", () => {
		expect(formatINR(92.5)).toBe("₹92.50");
		expect(formatINR("120.05")).toBe("₹120.05");
	});

	it("supports always and never paise modes", () => {
		expect(formatINR(80, { paise: "always" })).toBe("₹80.00");
		expect(formatINR(92.5, { paise: "never" })).toBe("₹93");
	});

	it("treats empty and invalid input as zero and keeps the sign", () => {
		expect(formatINR(null)).toBe("₹0");
		expect(formatINR("abc")).toBe("₹0");
		expect(formatINR(-50)).toBe("-₹50");
	});
});

describe("formatINRCompact", () => {
	it("keeps small amounts whole and compacts thousands and lakhs", () => {
		expect(formatINRCompact(950)).toBe("₹950");
		expect(formatINRCompact(7750)).toBe("₹7.8K");
		expect(formatINRCompact(1200882)).toBe("₹12L");
	});
});

describe("numbers and counts", () => {
	it("groups plain numbers the Indian way", () => {
		expect(formatNumber(123456)).toBe("1,23,456");
	});

	it("caps badge counts at 99+", () => {
		expect(formatBadgeCount(99)).toBe("99");
		expect(formatBadgeCount(100)).toBe("99+");
	});

	it("formats ratios as percentages", () => {
		expect(formatPercent(0.4231)).toBe("42%");
		expect(formatPercent(0.995)).toBe("100%");
	});

	it("pairs a count with its unit", () => {
		expect(formatCount(75, "sold")).toBe("75 sold");
		expect(formatCount(1, "sold")).toBe("1 sold");
		expect(formatCount(1, { one: "box", other: "boxes" })).toBe("1 box");
		expect(formatCount(0, { one: "box", other: "boxes" })).toBe("0 boxes");
		expect(formatCount(1200, "sold")).toBe("1,200 sold");
	});

	it("signs a change with a true minus, and leaves one that shows as zero unsigned", () => {
		expect(formatSigned(1500)).toBe("+1,500");
		expect(formatSigned(-3)).toBe("\u22123");
		expect(formatSigned(0)).toBe("0");
		expect(formatSigned(0.124, formatPercent)).toBe("+12%");
		expect(formatSigned(-0.004, formatPercent)).toBe("0%");
	});
});

describe("dates and times (IST)", () => {
	it("formats times with an upper-case meridiem in shop time", () => {
		expect(formatTime(halfPastMidnightIST)).toBe("12:30 AM");
		expect(formatTime(afternoonIST)).toBe("4:05 PM");
		expect(formatTime(afternoonIST.toISOString())).toBe("4:05 PM");
	});

	it("formats hours of the day, sharing the meridiem inside one half of the day", () => {
		expect(formatHour(0)).toBe("12 AM");
		expect(formatHour(12)).toBe("12 PM");
		expect(formatHourRange(13)).toBe("1–2 PM");
		expect(formatHourRange(11)).toBe("11 AM–12 PM");
		expect(formatHourRange(23)).toBe("11 PM–12 AM");
	});

	it("formats dates as day, short month and year", () => {
		expect(formatDate(halfPastMidnightIST)).toBe("23 Nov 2026");
		expect(formatDate("2025-12-17")).toBe("17 Dec 2025");
		expect(formatDateShort("2026-09-03")).toBe("3 Sep");
	});

	it("formats day headings", () => {
		expect(formatDayShort(halfPastMidnightIST)).toBe("Mon, 23 Nov");
		expect(formatFullDate("2026-11-23")).toBe("Monday, 23 November 2026");
	});

	it("names a day relative to today, dropping Yesterday when compact", () => {
		expect(formatRelativeDay("2026-11-23", "2026-11-23")).toBe("Today · 23 Nov");
		expect(formatRelativeDay("2026-11-22", "2026-11-23")).toBe("Yesterday · 22 Nov");
		expect(formatRelativeDay("2026-11-22", "2026-11-23", { compact: true })).toBe("Sun, 22 Nov");
		expect(formatRelativeDay("2026-11-21", "2026-11-23")).toBe("Sat, 21 Nov");
	});

	it("returns an empty string for invalid dates", () => {
		expect(formatDate("not a date")).toBe("");
		expect(formatTime("")).toBe("");
	});

	it("formats month keys without 'Sept'", () => {
		expect(formatMonth("2026-09")).toBe("September 2026");
		expect(formatMonthShort("2026-09")).toBe("Sep");
		expect(formatMonthShort("2026-09", { withYear: true })).toBe("Sep 2026");
		expect(formatMonth("2026-13")).toBe("");
	});

	it("formats a range of months, naming a shared year once", () => {
		expect(formatMonthRange("2026-01", "2026-09")).toBe("Jan–Sep 2026");
		expect(formatMonthRange("2025-11", "2026-09")).toBe("Nov 2025–Sep 2026");
		expect(formatMonthRange("2026-09", "2026-09")).toBe("September 2026");
	});
});

describe("lists", () => {
	it("joins names for a sentence", () => {
		expect(formatList(["Brownie"])).toBe("Brownie");
		expect(formatList(["Brownie", "Oreo"])).toBe("Brownie and Oreo");
		expect(formatList(["Brownie", "Oreo", "Nutella"])).toBe("Brownie, Oreo, and Nutella");
	});
});

describe("people", () => {
	it("builds initials from the words of a name", () => {
		expect(formatInitials("Council Admin")).toBe("CA");
		expect(formatInitials("Council Store Manager")).toBe("CM");
		expect(formatInitials("Imran")).toBe("IM");
		expect(formatInitials("council.manager@cocoacomaa.test")).toBe("CM");
		expect(formatInitials("")).toBe("?");
	});
});
