import type { MoveDirection } from "@/features/catalog/schemas";

type Placed = { id: number; enabled: boolean };

/**
 * The catalog order after moving one on-sale dessert among the others on sale. `ordered` is every
 * listed dessert in Sell-screen order; hidden desserts keep their places. Returns `null` when the
 * dessert is hidden or missing, and the same order when it cannot move further.
 */
export function moveInSellOrder<T extends Placed>(
	ordered: readonly T[],
	id: number,
	direction: MoveDirection,
): T[] | null {
	const from = ordered.findIndex((dessert) => dessert.id === id);
	if (from === -1 || !ordered[from].enabled) return null;

	const onSale = ordered.flatMap((dessert, index) => (dessert.enabled ? [index] : []));
	const rank = onSale.indexOf(from);
	const next = [...ordered];

	if (direction === "up" || direction === "down") {
		const neighbour = onSale[direction === "up" ? rank - 1 : rank + 1];
		if (neighbour === undefined) return next;
		[next[from], next[neighbour]] = [next[neighbour], next[from]];
		return next;
	}

	const [moved] = next.splice(from, 1);
	if (direction === "top") {
		next.splice(onSale[0] < from ? onSale[0] : from, 0, moved);
	} else {
		const last = onSale[onSale.length - 1];
		next.splice(last > from ? last : from, 0, moved);
	}
	return next;
}

/** Sequence numbers for `ordered`, as the `desserts.sequence` values that reproduce it. */
export function sequencesFor<T extends { id: number; sequence: number }>(ordered: readonly T[]): T[] {
	return ordered.map((dessert, index) => (dessert.sequence === index ? dessert : { ...dessert, sequence: index }));
}
