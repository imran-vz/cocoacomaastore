/**
 * Display formatting for every number, amount, date and label on screen.
 *
 * This module is the single source of truth (docs/design/DESIGN.md §Formatting).
 * Components never call `toFixed`, `toLocaleString`, `toLocaleDateString` or build
 * `₹`/`Rs` strings themselves. Dates and times are always shown in shop time (IST).
 */

export const SHOP_TIME_ZONE = "Asia/Kolkata";

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

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export type Paise = "auto" | "always" | "never";

export type FormatINROptions = {
	/**
	 * - `"auto"` (default): whole rupees show no decimals (`₹7,750`), fractional amounts show two (`₹92.50`).
	 * - `"always"`: always two decimals (`₹7,750.00`). Use only where paise must line up, e.g. invoices.
	 * - `"never"`: round to whole rupees (`₹93`). Use for reports and chart labels.
	 */
	paise?: Paise;
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

// ---------------------------------------------------------------------------
// Numbers and counts
// ---------------------------------------------------------------------------

const integer = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Indian digit grouping for plain counts: `1,23,456`. */
export function formatNumber(value: Numeric): string {
	return integer.format(Math.round(toNumber(value)));
}

/** A ratio (0–1) as a percentage: `formatPercent(0.4231)` → `"42%"`, `formatPercent(0.4231, 1)` → `"42.3%"`. */
export function formatPercent(ratio: Numeric, fractionDigits = 0): string {
	const value = toNumber(ratio) * 100;
	return `${value.toLocaleString("en-IN", {
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits,
	})}%`;
}

export type CountUnit = string | { one: string; other: string };

/** Nouns whose singular differs from the plural form we pass around. */
const SINGULARS: Record<string, string> = {
	items: "item",
	orders: "order",
	desserts: "dessert",
	combos: "combo",
	changes: "change",
	managers: "manager",
	accounts: "account",
	days: "day",
	units: "unit",
	extras: "extra",
};

/**
 * A count with its unit, singular when the count is 1.
 *
 * formatCount(75, "sold")   → "75 sold"
 * formatCount(5, "items")   → "5 items"
 * formatCount(1, "items")   → "1 item"
 * formatCount(2, { one: "box", other: "boxes" }) → "2 boxes"
 */
export function formatCount(value: Numeric, unit: CountUnit): string {
	const n = toNumber(value);
	const label =
		typeof unit === "string" ? (n === 1 ? (SINGULARS[unit] ?? unit) : unit) : n === 1 ? unit.one : unit.other;
	return `${formatNumber(n)} ${label}`;
}

// ---------------------------------------------------------------------------
// Dates and times (shop time, IST)
// ---------------------------------------------------------------------------

export type DateInput = Date | string | number;

type ShopDateParts = {
	year: number;
	/** 1–12 */
	month: number;
	day: number;
	/** 0 = Sunday */
	weekday: number;
	hour: number;
	minute: number;
};

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

const partsFormatter = new Intl.DateTimeFormat("en-US", {
	timeZone: SHOP_TIME_ZONE,
	year: "numeric",
	month: "numeric",
	day: "numeric",
	hour: "numeric",
	minute: "numeric",
	hourCycle: "h23",
});

function shopParts(input: DateInput): ShopDateParts | null {
	if (typeof input === "string") {
		const match = DATE_ONLY.exec(input);
		if (match) {
			// A calendar day key ("2026-11-23") is already a shop day: no time-zone shift.
			const year = Number(match[1]);
			const month = Number(match[2]);
			const day = Number(match[3]);
			return { year, month, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(), hour: 0, minute: 0 };
		}
	}
	const date = input instanceof Date ? input : new Date(input);
	if (Number.isNaN(date.getTime())) return null;
	const parts: Record<string, number> = {};
	for (const part of partsFormatter.formatToParts(date)) {
		if (part.type !== "literal") parts[part.type] = Number(part.value);
	}
	const { year, month, day } = parts;
	return {
		year,
		month,
		day,
		weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
		hour: parts.hour % 24,
		minute: parts.minute,
	};
}

/** `12:30 AM`, `4:05 PM` (shop time). */
export function formatTime(input: DateInput): string {
	const p = shopParts(input);
	if (!p) return "";
	const suffix = p.hour < 12 ? "AM" : "PM";
	const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
	return `${hour12}:${String(p.minute).padStart(2, "0")} ${suffix}`;
}

/** `23 Nov 2026`. */
export function formatDate(input: DateInput): string {
	const p = shopParts(input);
	if (!p) return "";
	return `${p.day} ${MONTHS_SHORT[p.month - 1]} ${p.year}`;
}

/** `23 Nov` — chart axes, compact rows within the current year. */
export function formatDateShort(input: DateInput): string {
	const p = shopParts(input);
	if (!p) return "";
	return `${p.day} ${MONTHS_SHORT[p.month - 1]}`;
}

/** `Monday, 23 November` — the day heading on Orders and Stock. */
export function formatDayHeading(input: DateInput): string {
	const p = shopParts(input);
	if (!p) return "";
	return `${WEEKDAYS_LONG[p.weekday]}, ${p.day} ${MONTHS_LONG[p.month - 1]}`;
}

/** `Mon, 23 Nov` — date switchers and other tight controls. */
export function formatDayShort(input: DateInput): string {
	const p = shopParts(input);
	if (!p) return "";
	return `${WEEKDAYS_SHORT[p.weekday]}, ${p.day} ${MONTHS_SHORT[p.month - 1]}`;
}

/** `23 Nov 2026, 12:30 AM`. */
export function formatDateTime(input: DateInput): string {
	const date = formatDate(input);
	return date ? `${date}, ${formatTime(input)}` : "";
}

export type MonthInput = string | { year: number; month: number } | Date;

function monthParts(input: MonthInput): { year: number; month: number } | null {
	if (typeof input === "string") {
		const match = /^(\d{4})-(\d{2})/.exec(input);
		if (!match) return null;
		const month = Number(match[2]);
		if (month < 1 || month > 12) return null;
		return { year: Number(match[1]), month };
	}
	if (input instanceof Date) {
		const p = shopParts(input);
		return p ? { year: p.year, month: p.month } : null;
	}
	return input;
}

/** `formatMonth("2026-09")` → `September 2026`. Accepts `YYYY-MM`, `{ year, month }` or a Date. */
export function formatMonth(input: MonthInput): string {
	const p = monthParts(input);
	return p ? `${MONTHS_LONG[p.month - 1]} ${p.year}` : "";
}

/** `formatMonthShort("2026-09")` → `Sep`; with `{ withYear: true }` → `Sep 2026`. */
export function formatMonthShort(input: MonthInput, options: { withYear?: boolean } = {}): string {
	const p = monthParts(input);
	if (!p) return "";
	const label = MONTHS_SHORT[p.month - 1];
	return options.withYear ? `${label} ${p.year}` : label;
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

/** The role as staff say it: `admin` → "Admin", anything else (`user`, null) → "Manager". */
export function roleLabel(role: string | null | undefined): "Admin" | "Manager" {
	return role === "admin" ? "Admin" : "Manager";
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
