/**
 * Validators for date-shaped query parameters on API routes.
 */

/** Accepts a real calendar date in YYYY-MM-DD form. */
export function isValidDateString(value: string | null): value is string {
	if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false;
	}

	const [year, month, day] = value.split("-").map(Number);
	const date = new Date(year, month - 1, day);
	return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Accepts a month key in YYYY-MM form. */
export function isValidMonth(value: string | null): value is string {
	return !!value && /^\d{4}-\d{2}$/.test(value);
}
