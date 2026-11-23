import { describe, expect, it } from "vitest";
import {
	formatCount,
	formatDate,
	formatDateShort,
	formatDateTime,
	formatDayHeading,
	formatDayShort,
	formatINR,
	formatINRCompact,
	formatInitials,
	formatMonth,
	formatMonthShort,
	formatNumber,
	formatPercent,
	formatTime,
	roleLabel,
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

	it("formats ratios as percentages", () => {
		expect(formatPercent(0.4231)).toBe("42%");
		expect(formatPercent(0.4231, 1)).toBe("42.3%");
	});

	it("pairs a count with its unit", () => {
		expect(formatCount(75, "sold")).toBe("75 sold");
		expect(formatCount(5, "items")).toBe("5 items");
		expect(formatCount(1, "items")).toBe("1 item");
		expect(formatCount(3, "changes")).toBe("3 changes");
		expect(formatCount(1, { one: "box", other: "boxes" })).toBe("1 box");
		expect(formatCount(1200, "sold")).toBe("1,200 sold");
	});
});

describe("dates and times (IST)", () => {
	it("formats times with an upper-case meridiem in shop time", () => {
		expect(formatTime(halfPastMidnightIST)).toBe("12:30 AM");
		expect(formatTime(afternoonIST)).toBe("4:05 PM");
		expect(formatTime(afternoonIST.toISOString())).toBe("4:05 PM");
	});

	it("formats dates as day, short month and year", () => {
		expect(formatDate(halfPastMidnightIST)).toBe("23 Nov 2026");
		expect(formatDate("2025-12-17")).toBe("17 Dec 2025");
		expect(formatDateShort("2026-09-03")).toBe("3 Sep");
		expect(formatDateTime(afternoonIST)).toBe("23 Nov 2026, 4:05 PM");
	});

	it("formats day headings", () => {
		expect(formatDayHeading("2026-11-23")).toBe("Monday, 23 November");
		expect(formatDayShort(halfPastMidnightIST)).toBe("Mon, 23 Nov");
	});

	it("returns an empty string for invalid dates", () => {
		expect(formatDate("not a date")).toBe("");
		expect(formatTime(Number.NaN)).toBe("");
	});

	it("formats month keys without 'Sept'", () => {
		expect(formatMonth("2026-09")).toBe("September 2026");
		expect(formatMonth({ year: 2026, month: 11 })).toBe("November 2026");
		expect(formatMonthShort("2026-09")).toBe("Sep");
		expect(formatMonthShort("2026-09", { withYear: true })).toBe("Sep 2026");
		expect(formatMonth("2026-13")).toBe("");
	});
});

describe("people", () => {
	it("maps roles to staff language", () => {
		expect(roleLabel("admin")).toBe("Admin");
		expect(roleLabel("user")).toBe("Manager");
		expect(roleLabel(null)).toBe("Manager");
	});

	it("builds initials from the words of a name", () => {
		expect(formatInitials("Council Admin")).toBe("CA");
		expect(formatInitials("Council Store Manager")).toBe("CM");
		expect(formatInitials("Imran")).toBe("IM");
		expect(formatInitials("council.manager@cocoacomaa.test")).toBe("CM");
		expect(formatInitials("")).toBe("?");
	});
});
