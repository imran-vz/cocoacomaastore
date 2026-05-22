const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export type YearMonth = {
	year: number;
	month: number;
};

function getISTDateParts(date: Date = new Date()) {
	const istTime = new Date(date.getTime() + IST_OFFSET_MS);
	return {
		year: istTime.getUTCFullYear(),
		month: istTime.getUTCMonth(),
		day: istTime.getUTCDate(),
	};
}

function getISTYearMonth(date: Date = new Date()): YearMonth {
	const ist = getISTDateParts(date);
	return { year: ist.year, month: ist.month + 1 };
}

export function istMidnightToUTC(year: number, month: number, day = 1): Date {
	return new Date(Date.UTC(year, month - 1, day) - IST_OFFSET_MS);
}

export function getStartOfDayIST(date: Date = new Date()) {
	const ist = getISTDateParts(date);
	return istMidnightToUTC(ist.year, ist.month + 1, ist.day);
}

export function getEndOfDayIST(date: Date = new Date()) {
	return new Date(getStartOfDayIST(date).getTime() + 86_400_000);
}

export function getAnalyticsDay(date: Date = new Date()) {
	const ist = getISTDateParts(date);
	return new Date(Date.UTC(ist.year, ist.month, ist.day));
}

export function getDayKey(date: Date = new Date()) {
	const ist = getISTDateParts(date);
	const y = ist.year;
	const m = String(ist.month + 1).padStart(2, "0");
	const d = String(ist.day).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

export function fmtMonth(year: number, month: number): string {
	return `${year}-${String(month).padStart(2, "0")}`;
}

export function getISTMonthKey(date: Date = new Date()) {
	const { year, month } = getISTYearMonth(date);
	return fmtMonth(year, month);
}

export function nextMonth(year: number, month: number): YearMonth {
	return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

export function pgTimestamp(date: Date): string {
	return date.toISOString().replace("T", " ").replace("Z", "");
}
