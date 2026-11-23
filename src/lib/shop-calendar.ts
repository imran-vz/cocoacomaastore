/**
 * Shop time: the store runs on India Standard Time, and its business day and month are IST
 * calendar days and months (ADR 0002). India has no daylight saving, so shop time is always
 * UTC+5:30. Timestamps stay UTC; this module turns them into shop days and back.
 *
 * A `DayKey` is a shop day as `YYYY-MM-DD`; a `MonthKey` is a shop month as `YYYY-MM`.
 */

export const SHOP_TIME_ZONE = "Asia/Kolkata";
const SHOP_OFFSET_MS = (5 * 60 + 30) * 60_000;
const DAY_MS = 86_400_000;

export type DayKey = string;
export type MonthKey = string;

export type ShopParts = {
	year: number;
	/** 1–12 */
	month: number;
	day: number;
	/** 0 = Sunday */
	weekday: number;
	hour: number;
	minute: number;
};

const pad = (value: number) => String(value).padStart(2, "0");

/** The shop-time calendar fields of an instant. */
export function shopParts(instant: Date): ShopParts {
	const shifted = new Date(instant.getTime() + SHOP_OFFSET_MS);
	return {
		year: shifted.getUTCFullYear(),
		month: shifted.getUTCMonth() + 1,
		day: shifted.getUTCDate(),
		weekday: shifted.getUTCDay(),
		hour: shifted.getUTCHours(),
		minute: shifted.getUTCMinutes(),
	};
}

function toDayKey(year: number, month: number, day: number): DayKey {
	return `${year}-${pad(month)}-${pad(day)}`;
}

function toMonthKey(year: number, month: number): MonthKey {
	return `${year}-${pad(month)}`;
}

/** The shop day an instant falls on. */
export function dayKeyOf(instant: Date = new Date()): DayKey {
	const { year, month, day } = shopParts(instant);
	return toDayKey(year, month, day);
}

/** The shop month an instant or shop day falls in. */
export function monthKeyOf(input: Date | DayKey = new Date()): MonthKey {
	return typeof input === "string" ? input.slice(0, 7) : dayKeyOf(input).slice(0, 7);
}

/** `value` as a DayKey if it names a real calendar day, otherwise null. */
export function parseDayKey(value: string | null | undefined): DayKey | null {
	const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
	if (!match) return null;
	const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
	const date = new Date(Date.UTC(year, month - 1, day));
	return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? (value as DayKey) : null;
}

/** `value` as a MonthKey if it names a real month, otherwise null. */
export function parseMonthKey(value: string | null | undefined): MonthKey | null {
	const match = value ? /^(\d{4})-(\d{2})$/.exec(value) : null;
	if (!match) return null;
	const month = Number(match[2]);
	return month >= 1 && month <= 12 ? (value as MonthKey) : null;
}

/** Calendar fields of a shop day (time fields are midnight). */
export function dayKeyParts(dayKey: DayKey): ShopParts {
	const [year, month, day] = dayKey.split("-").map(Number);
	return { year, month, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(), hour: 0, minute: 0 };
}

/** The instant a shop day starts. */
export function dayStart(dayKey: DayKey): Date {
	const { year, month, day } = dayKeyParts(dayKey);
	return new Date(Date.UTC(year, month - 1, day) - SHOP_OFFSET_MS);
}

/** The instant a shop day ends (the next day's start). */
export function dayEnd(dayKey: DayKey): Date {
	return new Date(dayStart(dayKey).getTime() + DAY_MS);
}

export function addDays(dayKey: DayKey, days: number): DayKey {
	const { year, month, day } = dayKeyParts(dayKey);
	const date = new Date(Date.UTC(year, month - 1, day + days));
	return toDayKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addMonths(monthKey: MonthKey, months: number): MonthKey {
	const [year, month] = monthKey.split("-").map(Number);
	const index = year * 12 + (month - 1) + months;
	return toMonthKey(Math.floor(index / 12), (index % 12) + 1);
}

/** The first shop day of a month. */
export function monthFirstDay(monthKey: MonthKey): DayKey {
	return `${monthKey}-01`;
}

/** The last shop day of a month. */
export function monthLastDay(monthKey: MonthKey): DayKey {
	return addDays(monthFirstDay(addMonths(monthKey, 1)), -1);
}

/** Every day from `first` to `last`, inclusive. */
export function daysBetween(first: DayKey, last: DayKey): DayKey[] {
	const days: DayKey[] = [];
	for (let day = first; day <= last; day = addDays(day, 1)) days.push(day);
	return days;
}

/** The instant a shop month starts. */
export function monthStart(monthKey: MonthKey): Date {
	return dayStart(monthFirstDay(monthKey));
}

/** The instant a shop month ends (the next month's start). */
export function monthEnd(monthKey: MonthKey): Date {
	return monthStart(addMonths(monthKey, 1));
}

/**
 * The value stored in the `day` columns (analytics rows, daily inventory) for a shop day: UTC
 * midnight of that calendar day. The columns are `timestamp` without time zone, which Drizzle
 * writes and reads back as UTC, so the value round-trips to the same day.
 */
export function analyticsDate(dayKey: DayKey): Date {
	const { year, month, day } = dayKeyParts(dayKey);
	return new Date(Date.UTC(year, month - 1, day));
}

/** The shop day a `day` column value names. */
export function dayKeyOfAnalyticsDate(date: Date): DayKey {
	return date.toISOString().slice(0, 10);
}
