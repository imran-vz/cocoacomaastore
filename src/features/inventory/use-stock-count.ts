"use client";

import { useCallback, useMemo, useState } from "react";
import { saveTodayStock } from "@/features/inventory/actions";
import type { CountableDessert } from "@/features/inventory/shapes";
import {
	draftsAfterConflict,
	draftsAfterSave,
	editDraft,
	pendingStock,
	type StockDrafts,
} from "@/features/inventory/stock-count";
import type { TodayInventory } from "@/features/inventory/use-today-inventory";
import { type ActionResult, useRunAction } from "@/lib/action-result";

/**
 * Typing and saving today's counts for `desserts`, over the stored counts in `inventory`. `save`
 * answers with how many counts it saved, or why it saved none.
 */
export function useStockCount(desserts: readonly CountableDessert[], inventory: TodayInventory) {
	const runAction = useRunAction();
	const { storedCount, refresh } = inventory;
	const [drafts, setDrafts] = useState<StockDrafts>(new Map());
	const [isSaving, setIsSaving] = useState(false);

	const pending = useMemo(() => pendingStock(desserts, drafts), [desserts, drafts]);

	const edit = useCallback(
		(dessertId: number, value: string) =>
			setDrafts((current) => editDraft(current, dessertId, value, storedCount(dessertId))),
		[storedCount],
	);

	// Saving or conflicting drops drafts, so the stored counts are refetched before the fields fall back to them.
	const save = useCallback(async (): Promise<ActionResult<number>> => {
		if (pending.invalid) return { ok: false, error: pending.invalid };
		if (pending.updates.length === 0) return { ok: true, data: 0 };

		setIsSaving(true);
		try {
			const result = await runAction(saveTodayStock(pending.updates), { fallback: "Failed to save" });
			if (!result.ok) return result;
			if (result.data.status === "conflict") {
				const { conflictedIds } = result.data;
				await refresh();
				setDrafts((current) => draftsAfterConflict(current, conflictedIds));
				return { ok: false, error: "Stock changed — review and save again" };
			}
			setDrafts((current) => draftsAfterSave(current, pending.updates));
			return { ok: true, data: pending.updates.length };
		} finally {
			setIsSaving(false);
		}
	}, [pending, refresh, runAction]);

	return {
		/** What the field for a dessert shows: the typed count, or the stored one. */
		countText: (dessertId: number) => drafts.get(dessertId)?.value ?? String(storedCount(dessertId)),
		/** The stored count a changed field was typed over. */
		startingCount: (dessertId: number) => drafts.get(dessertId)?.base ?? storedCount(dessertId),
		changedIds: pending.changedIds,
		hasChanges: pending.changedIds.size > 0,
		edit,
		discard: () => setDrafts(new Map()),
		save,
		isSaving,
	};
}

export type StockCount = ReturnType<typeof useStockCount>;
