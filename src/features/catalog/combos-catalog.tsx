"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { use, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow } from "@/components/ui/list-row";
import { SearchField } from "@/components/ui/search-field";
import type { Area } from "@/features/access/area";
import { setComboListed } from "@/features/catalog/actions";
import { CatalogRecords, ListingSwitch, useCatalogList } from "@/features/catalog/catalog-list";
import { CatalogFilterControl, CatalogHeader } from "@/features/catalog/catalog-toolbar";
import { comboCatalogQuery } from "@/features/catalog/client";
import { ComboFormSheet } from "@/features/catalog/combo-form-sheet";
import type { ComboCatalog, ComboWithDetails } from "@/features/catalog/queries";
import { type ComboSaleProblem, comboPriceOf, comboSaleProblems } from "@/features/catalog/rules";
import { formatINR, UNIT } from "@/lib/format";
import type { ServerSnapshot } from "@/lib/server-snapshot";
import { useSeededQuery } from "@/lib/use-seeded-query";

/** "Choco Fudge Brownie + Nutella + 2× Oreo" */
function describeCombo(combo: ComboWithDetails) {
	const extras = combo.items.map((item) =>
		item.quantity > 1 ? `${item.quantity}× ${item.dessert.name}` : item.dessert.name,
	);
	return [combo.baseDessert.name, ...extras].join(" + ");
}

type ComboDessert = ComboWithDetails["items"][number]["dessert"];

function problemNote({ dessert, problem }: ComboSaleProblem<ComboDessert>) {
	switch (problem) {
		case "removed":
			return `${dessert.name} removed`;
		case "wrong-kind":
			return `${dessert.name} ${dessert.kind === "modifier" ? "is an add-on" : "is not an add-on"}`;
		case "hidden":
			return `${dessert.name} hidden`;
		case "out-of-stock":
			return `${dessert.name} out of stock`;
	}
}

/** What the row says about a combo the Sell screen doesn't show: "Hidden", or "Not on sale: Nutella removed". */
function saleNote(combo: ComboWithDetails, listed: boolean): string | null {
	if (!listed) return "Hidden";
	const problems = comboSaleProblems<ComboDessert>(
		combo.baseDessert,
		combo.items.map(({ dessert }) => dessert),
	);
	return problems.length === 0 ? null : `Not on sale: ${problems.map(problemNote).join(", ")}`;
}

/** The Combos tab of the Catalog (DESIGN.md §Records). */
export function CombosCatalog({
	area,
	catalog: initialCatalog,
}: {
	area: Area;
	catalog: Promise<ServerSnapshot<ComboCatalog>>;
}) {
	const queryClient = useQueryClient();
	const { data: catalog, refetch } = useSeededQuery(comboCatalogQuery, use(initialCatalog));
	// The combo stays set while the sheet closes, so its title doesn't change mid-animation.
	const [sheet, setSheet] = useState<{ open: boolean; combo: ComboWithDetails | null }>({ open: false, combo: null });
	const openSheet = (combo: ComboWithDetails | null) => setSheet({ open: true, combo });

	const list = useCatalogList({
		records: catalog.combos,
		setRecords: (update) =>
			queryClient.setQueryData(comboCatalogQuery.queryKey, (current) =>
				current ? { ...current, data: { ...current.data, combos: update(current.data.combos) } } : current,
			),
		refetch,
		setListed: setComboListed,
	});

	const renderRows = (combos: ComboWithDetails[]) =>
		combos.map((combo) => (
			<ListRow
				key={combo.id}
				title={combo.name}
				meta={[
					describeCombo(combo),
					combo.overridePrice !== null ? "Custom price" : null,
					saleNote(combo, list.isListed(combo)),
				]
					.filter(Boolean)
					.join(" · ")}
				trailing={formatINR(comboPriceOf(combo))}
				onClick={() => openSheet(combo)}
				rowLabel={`Edit ${combo.name}`}
				action={
					<ListingSwitch
						name={combo.name}
						checked={combo.enabled}
						status={list.toggleStatus(combo.id)}
						onToggle={() => void list.toggle(combo)}
					/>
				}
			/>
		));

	const openCreate = () => openSheet(null);

	return (
		<div className="w-full">
			<ComboFormSheet
				open={sheet.open}
				onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
				combo={sheet.combo}
				catalog={catalog}
			/>

			<CatalogHeader
				area={area}
				onSale={list.onSaleCount}
				hidden={list.hiddenCount}
				addLabel="Add combo"
				onAdd={openCreate}
				canReorder={catalog.bases.length + catalog.addOns.length >= 2}
				canHideAll={catalog.bases.length + catalog.addOns.length > 0}
			/>

			<div className="flex flex-col gap-3 pb-4">
				<SearchField label="Search combos" value={list.searchTerm} onChange={list.setSearchTerm} />
				<CatalogFilterControl
					label="Show combos"
					value={list.filter}
					onValueChange={list.setFilter}
					availableCount={list.available.length}
					hiddenCount={list.hidden.length}
				/>
			</div>

			<CatalogRecords
				list={list}
				noun={UNIT.combo}
				renderRows={renderRows}
				whenNoneOnSale={
					<EmptyState
						variant="block"
						title="No combos on sale"
						description="A combo sells a dessert with its add-ons in one tap."
						action={
							<Button onClick={openCreate}>
								<Plus aria-hidden="true" />
								Add combo
							</Button>
						}
					/>
				}
			/>
		</div>
	);
}
