import { type StockUpdate, stockQuantitySchema } from "@/features/inventory/schemas";
import { type CountableDessert, isCounted } from "@/features/inventory/shapes";

/** A count being typed for one dessert, with the stored count it was typed over. */
type StockDraft = { value: string; base: number };
export type StockDrafts = ReadonlyMap<number, StockDraft>;

function parseCount(value: string) {
	return stockQuantitySchema.safeParse(value.trim() === "" ? Number.NaN : Number(value));
}

/**
 * Records a typed count over the stored count it started from. Typing the starting count back
 * drops the draft, so the field follows fresh stored counts again.
 */
export function editDraft(drafts: StockDrafts, dessertId: number, value: string, stored: number): StockDrafts {
	const base = drafts.get(dessertId)?.base ?? stored;
	const next = new Map(drafts);
	const parsed = parseCount(value);
	if (parsed.success && parsed.data === base) next.delete(dessertId);
	else next.set(dessertId, { value, base });
	return next;
}

type PendingStock = {
	/** Desserts whose typed count differs from the count it was typed over (including unreadable entries). */
	changedIds: ReadonlySet<number>;
	updates: StockUpdate[];
	/** Why the counts can't be saved yet, if any typed count is not a valid count. */
	invalid: string | null;
};

export function pendingStock(desserts: readonly CountableDessert[], drafts: StockDrafts): PendingStock {
	const changedIds = new Set<number>();
	const updates: StockUpdate[] = [];
	let invalid: string | null = null;

	for (const dessert of desserts) {
		const draft = drafts.get(dessert.id);
		if (!draft || !isCounted(dessert)) continue;
		const parsed = parseCount(draft.value);
		if (!parsed.success) {
			changedIds.add(dessert.id);
			invalid ??= parsed.error.issues[0]?.message ?? "Enter a valid count";
			continue;
		}
		if (parsed.data === draft.base) continue;
		changedIds.add(dessert.id);
		updates.push({ dessertId: dessert.id, expectedQuantity: draft.base, quantity: parsed.data });
	}

	return { changedIds, updates, invalid };
}

/** Drafts after `saved` was written: counts still showing what was saved are done; any typed since now sit on the saved count. */
export function draftsAfterSave(drafts: StockDrafts, saved: readonly StockUpdate[]): StockDrafts {
	const next = new Map(drafts);
	for (const { dessertId, quantity } of saved) {
		const draft = next.get(dessertId);
		if (!draft) continue;
		const parsed = parseCount(draft.value);
		if (parsed.success && parsed.data === quantity) next.delete(dessertId);
		else next.set(dessertId, { ...draft, base: quantity });
	}
	return next;
}

/** Drafts after a conflicting save: the desserts whose stored counts moved go back to showing them. */
export function draftsAfterConflict(drafts: StockDrafts, conflictedIds: Iterable<number>): StockDrafts {
	const next = new Map(drafts);
	for (const dessertId of conflictedIds) next.delete(dessertId);
	return next;
}
