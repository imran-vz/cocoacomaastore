/** Edit distance between two strings (insertions, deletions and substitutions each cost 1). */
function editDistance(a: string, b: string): number {
	let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
	for (let i = 1; i <= a.length; i++) {
		const current = [i];
		for (let j = 1; j <= b.length; j++) {
			const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
			current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
		}
		previous = current;
	}
	return previous[b.length];
}

/**
 * A warning about the name typed for a dessert:
 * - `exact`: another dessert already has it (ignoring case); saving will be refused.
 * - `starts-with`: other desserts begin with it (3+ characters typed).
 * - `close`: it is a likely typo of another name (6+ characters, at most 2 edits).
 */
type NameHint =
	| { tier: "exact"; message: string }
	| { tier: "starts-with"; message: string }
	| { tier: "close"; message: string; match: string };

export function nameHint(input: string, otherNames: readonly string[]): NameHint | null {
	const typed = input.trim().toLowerCase();
	if (!typed) return null;

	const exact = otherNames.find((name) => name.toLowerCase() === typed);
	if (exact) return { tier: "exact", message: `A dessert named "${exact}" already exists` };

	if (typed.length >= 3) {
		const prefixed = otherNames.filter((name) => name.toLowerCase().startsWith(typed));
		if (prefixed.length > 0) {
			return { tier: "starts-with", message: `Similar desserts exist: ${prefixed.slice(0, 3).join(", ")}` };
		}
	}

	if (typed.length >= 6) {
		const close = otherNames.find((name) => editDistance(typed, name.toLowerCase()) <= 2);
		if (close) return { tier: "close", message: `Did you mean "${close}"?`, match: close };
	}

	return null;
}
