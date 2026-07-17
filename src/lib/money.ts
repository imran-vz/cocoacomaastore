/** Parses a decimal money string (e.g. "120.50") into integer cents. */
export function parseMoneyCents(value: string) {
	const [whole, fraction = ""] = value.split(".");
	return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
