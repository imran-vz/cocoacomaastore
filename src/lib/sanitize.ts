/**
 * Removes HTML tags (with their attributes) and comments, and NUL bytes, then trims. A `<`
 * that doesn't open a tag ("a < b > c") is kept. What remains is plain text: React escapes it
 * and nothing puts it in a URL or attribute, so text like "Bonbons = 5" or "javascript: 101"
 * is left alone.
 */
export function stripMarkup(input: string): string {
	return input
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(/<\/?[a-z][^<>]*>/gi, "")
		.split("\u0000")
		.join("")
		.trim();
}
