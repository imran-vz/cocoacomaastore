/** A non-negative rupee amount with at most two decimals, as Postgres `numeric` columns return it. */
const DECIMAL_AMOUNT = /^(\d+)(?:\.(\d{1,2}))?$/;
/** The same amount as a number field may hold it while staff type: `40`, `40.`, `.5`. */
const TYPED_AMOUNT = /^(?=\.?\d)(\d*)(?:\.(\d{0,2}))?$/;

function centsOf(match: RegExpExecArray | null): number | null {
	if (!match) return null;
	const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
	return Number.isSafeInteger(cents) ? cents : null;
}

export function isDecimalAmount(value: string): boolean {
	return DECIMAL_AMOUNT.test(value);
}

/** A decimal rupee amount (`"120.5"`, `"120.50"`, `"120"`) in integer paise. */
export function toCents(value: string): number {
	const cents = centsOf(DECIMAL_AMOUNT.exec(value));
	if (cents === null) throw new Error(`Invalid amount: ${value}`);
	return cents;
}

/** A rupee amount typed into a field, in integer paise; null when the text is not one. */
export function typedAmountCents(text: string): number | null {
	return centsOf(TYPED_AMOUNT.exec(text.trim()));
}

/** Integer paise as rupees, for display (`formatINR`). */
export function rupees(cents: number): number {
	return cents / 100;
}

/** Integer paise as the two-decimal string Postgres `numeric(_, 2)` columns store. */
export function centsToDecimal(cents: number): string {
	return rupees(cents).toFixed(2);
}
