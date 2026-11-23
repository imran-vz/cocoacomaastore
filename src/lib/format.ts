/**
 * Display formatting for every number, amount, date and label on screen.
 *
 * This module is the single source of truth (docs/design/DESIGN.md, "Numbers and formatting").
 * Components never call `toFixed`, `toLocaleString`, `toLocaleDateString` or build
 * `₹`/`Rs` strings themselves. Dates and times are always shown in shop time (IST).
 */

import {
	addDays,
	type DayKey,
	dayKeyParts,
	type MonthKey,
	parseDayKey,
	parseMonthKey,
	type ShopParts,
	shopParts,
} from "@/lib/shop-calendar";

const MONTHS_LONG = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
] as const;

/** Three-letter month names. Always "Sep", never "Sept" (ICU's en-GB/en-IN output). */
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type FormatINROptions = {
	/**
	 * - `"auto"` (default): whole rupees show no decimals (`₹7,750`), fractional amounts show two (`₹92.50`).
	 * - `"always"`: always two decimals (`₹7,750.00`). Use only where paise must line up, e.g. invoices.
	 * - `"never"`: round to whole rupees (`₹93`). Use for reports and chart labels.
	 */
	paise?: "auto" | "always" | "never";
};

type Numeric = number | string | null | undefined;

function toNumber(value: Numeric): number {
	if (value === null || value === undefined || value === "") return 0;
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
}

const inrWhole = new Intl.NumberFormat("en-IN", {
	style: "currency",
	currency: "INR",
	minimumFractionDigits: 0,
	maximumFractionDigits: 0,
});

const inrPaise = new Intl.NumberFormat("en-IN", {
	style: "currency",
	currency: "INR",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

const inrCompact = new Intl.NumberFormat("en-IN", {
	style: "currency",
	currency: "INR",
	notation: "compact",
	maximumFractionDigits: 1,
});

/**
 * Formats rupees with Indian (lakh) grouping and the `₹` sign.
 * Accepts numbers or decimal strings straight from the database (`"120.50"`).
 *
 * formatINR(7750)            → "₹7,750"
 * formatINR("92.5")          → "₹92.50"
 * formatINR(1200882)         → "₹12,00,882"
 * formatINR(80, { paise: "always" }) → "₹80.00"
 */
export function formatINR(value: Numeric, options: FormatINROptions = {}): string {
	const amount = toNumber(value);
	const paise = options.paise ?? "auto";
	if (paise === "always") return inrPaise.format(amount);
	if (paise === "never") return inrWhole.format(Math.round(amount));
	const hasPaise = Math.round(Math.abs(amount) * 100) % 100 !== 0;
	return hasPaise ? inrPaise.format(amount) : inrWhole.format(amount);
}

/** Short rupee label for chart axes and tight KPI tiles: `₹950`, `₹7.8K`, `₹12L`. */
export function formatINRCompact(value: Numeric): string {
	const amount = toNumber(value);
	if (Math.abs(amount) < 1000) return inrWhole.format(Math.round(amount));
	return inrCompact.format(amount);
}

const integer = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Indian digit grouping for plain counts: `1,23,456`. */
export function formatNumber(value: Numeric): string {
	return integer.format(Math.round(toNumber(value)));
}

/** A count in a small badge, capped so it fits: `7`, `99+`. */
export function formatBadgeCount(count: number): string {
	return count > 99 ? "99+" : String(count);
}

/** A ratio (0–1) as a whole percentage: `formatPercent(0.4231)` → `"42%"`. */
export function formatPercent(ratio: Numeric): string {
	return `${formatNumber(toNumber(ratio) * 100)}%`;
}

/**
 * A change with its sign, the size shown by `format`: `+12`, `−3` (a true minus sign), and no
 * sign when it shows as zero.
 *
 * formatSigned(-3) → "−3"
 * formatSigned(0.124, formatPercent) → "+12%"
 * formatSigned(0.004, formatPercent) → "0%"
 */
export function formatSigned(change: number, format: (size: number) => string = formatNumber): string {
	const size = format(Math.abs(change));
	if (size === format(0)) return size;
	return `${change > 0 ? "+" : "\u2212"}${size}`;
}

/** An order's number as staff say it: `#1042`. */
export function formatOrderNumber(orderId: number): string {
	return `#${orderId}`;
}

/** The nouns counted on screen, for `formatCount`. */
export const UNIT = {
	change: { one: "change", other: "changes" },
	combo: { one: "combo", other: "combos" },
	dessert: { one: "dessert", other: "desserts" },
	hour: { one: "hour", other: "hours" },
	item: { one: "item", other: "items" },
	month: { one: "month", other: "months" },
	order: { one: "order", other: "orders" },
} as const;

/**
 * A count with its unit: a word that never changes (`"sold"`, `"left"`) or a noun's two forms.
 *
 * formatCount(75, "sold") → "75 sold"
 * formatCount(1, UNIT.item) → "1 item"
 */
export function formatCount(value: Numeric, unit: string | { one: string; other: string }): string {
	const n = toNumber(value);
	const label = typeof unit === "string" ? unit : n === 1 ? unit.one : unit.other;
	return `${formatNumber(n)} ${label}`;
}

/** A shop day (`YYYY-MM-DD`), or an instant (a Date or an ISO string) shown in shop time. */
type DateInput = Date | string;

function partsOf(input: DateInput): ShopParts | null {
	if (typeof input === "string") {
		const dayKey = parseDayKey(input);
		if (dayKey) return dayKeyParts(dayKey);
	}
	const date = input instanceof Date ? input : new Date(input);
	return Number.isNaN(date.getTime()) ? null : shopParts(date);
}

function clock12(hour: number) {
	const normalized = ((hour % 24) + 24) % 24;
	return { hour12: normalized % 12 === 0 ? 12 : normalized % 12, suffix: normalized < 12 ? "AM" : "PM" };
}

/** `12:30 AM`, `4:05 PM` (shop time). */
export function formatTime(input: DateInput): string {
	const p = partsOf(input);
	if (!p) return "";
	const { hour12, suffix } = clock12(p.hour);
	return `${hour12}:${String(p.minute).padStart(2, "0")} ${suffix}`;
}

/** An hour of the day (0–23): `0` → `12 AM`, `13` → `1 PM`. */
export function formatHour(hour: number): string {
	const { hour12, suffix } = clock12(hour);
	return `${hour12} ${suffix}`;
}

/** The hour starting at `hour`: `13` → `1–2 PM`, `11` → `11 AM–12 PM`. */
export function formatHourRange(hour: number): string {
	const start = clock12(hour);
	const end = clock12(hour + 1);
	return start.suffix === end.suffix
		? `${start.hour12}–${end.hour12} ${end.suffix}`
		: `${formatHour(hour)}–${formatHour(hour + 1)}`;
}

/** `Mon` / `Monday` for a weekday number (0 = Sunday). */
export function formatWeekday(weekday: number, style: "short" | "long" = "short"): string {
	return (style === "short" ? WEEKDAYS_SHORT : WEEKDAYS_LONG)[weekday] ?? "";
}

/** `23 Nov 2026`. */
export function formatDate(input: DateInput): string {
	const p = partsOf(input);
	if (!p) return "";
	return `${p.day} ${MONTHS_SHORT[p.month - 1]} ${p.year}`;
}

/** `23 Nov` — chart axes, compact rows within the current year. */
export function formatDateShort(input: DateInput): string {
	const p = partsOf(input);
	if (!p) return "";
	return `${p.day} ${MONTHS_SHORT[p.month - 1]}`;
}

/** `Mon, 23 Nov` — date switchers and other tight controls. */
export function formatDayShort(input: DateInput): string {
	const p = partsOf(input);
	if (!p) return "";
	return `${WEEKDAYS_SHORT[p.weekday]}, ${p.day} ${MONTHS_SHORT[p.month - 1]}`;
}

/** `Monday, 23 November 2026`: a shop day named in full, e.g. a calendar day's accessible name. */
export function formatFullDate(day: DayKey): string {
	const p = dayKeyParts(day);
	return `${WEEKDAYS_LONG[p.weekday]}, ${p.day} ${MONTHS_LONG[p.month - 1]} ${p.year}`;
}

/**
 * A shop day relative to `today`: `Today · 23 Nov`, `Yesterday · 22 Nov`, otherwise
 * `Sat, 21 Nov`. `compact` drops "Yesterday · " so the date fits a phone's date stepper.
 */
export function formatRelativeDay(day: DayKey, today: DayKey, { compact = false } = {}): string {
	if (day === today) return `Today · ${formatDateShort(day)}`;
	if (!compact && day === addDays(today, -1)) return `Yesterday · ${formatDateShort(day)}`;
	return formatDayShort(day);
}

function monthParts(month: MonthKey): { year: number; month: number } | null {
	const key = parseMonthKey(month);
	if (!key) return null;
	const [year, monthNumber] = key.split("-").map(Number);
	return { year, month: monthNumber };
}

/** `formatMonth("2026-09")` → `September 2026`. */
export function formatMonth(month: MonthKey): string {
	const p = monthParts(month);
	return p ? `${MONTHS_LONG[p.month - 1]} ${p.year}` : "";
}

/** `formatMonthShort("2026-09")` → `Sep`; with `{ withYear: true }` → `Sep 2026`. */
export function formatMonthShort(month: MonthKey, options: { withYear?: boolean } = {}): string {
	const p = monthParts(month);
	if (!p) return "";
	const label = MONTHS_SHORT[p.month - 1];
	return options.withYear ? `${label} ${p.year}` : label;
}

/** The months `first` through `last`: `Jan–Sep 2026`, `Nov 2025–Sep 2026`, or `September 2026` for one month. */
export function formatMonthRange(first: MonthKey, last: MonthKey): string {
	if (first === last) return formatMonth(first);
	const sameYear = monthParts(first)?.year === monthParts(last)?.year;
	return `${formatMonthShort(first, { withYear: !sameYear })}–${formatMonthShort(last, { withYear: true })}`;
}

const listFormat = new Intl.ListFormat("en", { type: "conjunction" });

/** Names joined for a sentence: `Brownie`, `Brownie and Oreo`, `Brownie, Oreo, and Nutella`. */
export function formatList(items: readonly string[]): string {
	return listFormat.format(items);
}

/**
 * Avatar initials from the words of a name: "Council Admin" → "CA", "Imran" → "IM",
 * "council.manager@cocoacomaa.test" → "CM".
 */
export function formatInitials(name: string | null | undefined): string {
	const source = (name ?? "").split("@")[0];
	const words = source.split(/[\s._-]+/).filter(Boolean);
	if (words.length === 0) return "?";
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

/** Each space-separated word starts with a capital: "choco fudge" → "Choco Fudge". */
export function capitalizeWords(text: string): string {
	return text
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}
