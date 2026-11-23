"use client";

import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FEEDBACK_MS, type FeedbackStatus } from "@/components/ui/feedback";
import { FeedbackCheck } from "@/components/ui/feedback-check";
import { ListSection, RecordList } from "@/components/ui/list-row";
import { Switch } from "@/components/ui/switch";
import { useFeedbackStore } from "@/components/ui/use-feedback-store";
import type { CatalogFilter } from "@/features/catalog/catalog-toolbar";
import { type ActionResult, useRunAction } from "@/lib/action-result";

type Listed = { id: number; name: string; enabled: boolean };

/**
 * Search, the Available | Hidden filter and the on-sale switch shared by the Desserts and Combos
 * lists. A switched record stays in its section until its feedback flash ends, so it doesn't jump
 * away from under the finger.
 */
export function useCatalogList<T extends Listed>({
	records,
	setRecords,
	refetch,
	setListed,
}: {
	records: T[];
	setRecords: (update: (records: T[]) => T[]) => void;
	/** Reloads the records, undoing a failed switch shown ahead of its save. */
	refetch: () => Promise<unknown>;
	setListed: (id: number, enabled: boolean) => Promise<ActionResult>;
}) {
	const [searchTerm, setSearchTerm] = useState("");
	const [filter, setFilter] = useState<CatalogFilter>("available");
	const [pinned, setPinned] = useState<ReadonlyMap<number, boolean>>(new Map());
	const feedback = useFeedbackStore();
	const runAction = useRunAction();

	const unpin = (id: number) =>
		setPinned((current) => {
			const next = new Map(current);
			next.delete(id);
			return next;
		});
	const isListed = (record: T) => pinned.get(record.id) ?? record.enabled;
	const setEnabled = (id: number, enabled: boolean) =>
		setRecords((current) => current.map((record) => (record.id === id ? { ...record, enabled } : record)));

	const toggle = async (record: T) => {
		const key = `listing-${record.id}`;
		const enabled = !record.enabled;
		setPinned((current) => new Map(current).set(record.id, record.enabled));
		setEnabled(record.id, enabled);
		const token = feedback.start(key);

		const result = await runAction(setListed(record.id, enabled), { fallback: `Couldn't update ${record.name}` });
		if (!result.ok) {
			setEnabled(record.id, record.enabled);
			unpin(record.id);
			feedback.settle(key, "error", undefined, { token, announcement: result.error });
			await refetch();
			return;
		}
		feedback.settle(key, "success", undefined, {
			token,
			duration: FEEDBACK_MS.inline,
			announcement: `${record.name} ${enabled ? "available" : "hidden"}`,
			onComplete: () => unpin(record.id),
		});
	};

	const term = searchTerm.trim().toLowerCase();
	const matches = records.filter((record) => record.name.toLowerCase().includes(term));
	const available = matches.filter(isListed);
	const hidden = matches.filter((record) => !isListed(record));
	const onSaleCount = records.filter(isListed).length;

	return {
		searchTerm,
		setSearchTerm,
		filter,
		setFilter,
		isListed,
		available,
		hidden,
		visible: filter === "available" ? available : hidden,
		/** Unfiltered counts for the header, so they don't move while searching. */
		onSaleCount,
		hiddenCount: records.length - onSaleCount,
		/** Searching Available also lists hidden matches below, so a hidden record is never "not found". */
		showHiddenMatches: filter === "available" && term !== "" && hidden.length > 0,
		toggle,
		toggleStatus: (id: number): FeedbackStatus => feedback.get(`listing-${id}`).status,
	};
}

type CatalogList<T extends Listed> = ReturnType<typeof useCatalogList<T>>;

/** The on-sale switch at the end of a catalog row. */
export function ListingSwitch({
	name,
	checked,
	status,
	onToggle,
}: {
	name: string;
	checked: boolean;
	status: FeedbackStatus;
	onToggle: () => void;
}) {
	return (
		<span className="flex h-11 items-center">
			<span className="relative inline-flex rounded-full">
				<Switch checked={checked} onCheckedChange={onToggle} disabled={status !== "idle"} aria-label={`Sell ${name}`} />
				<FeedbackCheck status={status} />
			</span>
		</span>
	);
}

/** The filtered rows, the empty state when there are none, and hidden matches while searching Available. */
export function CatalogRecords<T extends Listed>({
	list,
	noun,
	renderRows,
	whenNoneOnSale,
	withHiddenMatches = true,
}: {
	list: CatalogList<T>;
	/** Lower case, from `UNIT`: `UNIT.dessert`. */
	noun: { one: string; other: string };
	renderRows: (records: T[]) => ReactNode;
	/** What to show when nothing is on sale and nothing is being searched. */
	whenNoneOnSale: ReactNode;
	withHiddenMatches?: boolean;
}) {
	const term = list.searchTerm.trim();
	const { one, other } = noun;

	let empty: ReactNode = null;
	if (list.visible.length === 0) {
		if (list.showHiddenMatches) {
			empty = <EmptyState description={`No available ${other} match “${term}”.`} />;
		} else if (term) {
			empty = (
				<EmptyState
					title={`No ${other} match “${term}”`}
					description="Check the spelling or clear the search."
					action={
						<Button variant="outline" size="sm" onClick={() => list.setSearchTerm("")}>
							Clear search
						</Button>
					}
				/>
			);
		} else if (list.filter === "hidden") {
			empty = <EmptyState description={`No hidden ${other}. Every ${one} is on the Sell screen.`} />;
		} else {
			empty = whenNoneOnSale;
		}
	}

	return (
		<>
			{empty ?? (
				<RecordList aria-label={`${list.filter === "available" ? "Available" : "Hidden"} ${other}`}>
					{renderRows(list.visible)}
				</RecordList>
			)}
			{withHiddenMatches && list.showHiddenMatches ? (
				<ListSection title="Hidden" count={list.hidden.length} className="pt-6">
					<RecordList aria-label={`Hidden ${other} matching your search`}>{renderRows(list.hidden)}</RecordList>
				</ListSection>
			) : null}
		</>
	);
}
