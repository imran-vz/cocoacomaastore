"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import {
	type CatalogArea,
	type CatalogFilter,
	CatalogFilterControl,
	CatalogHeader,
	CatalogSearch,
} from "@/components/catalog-toolbar";
import { ComboFormDialog } from "@/components/combo-form-dialog";
import { ActionFeedbackCheckOverlay } from "@/components/ui/action-feedback";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow, ListSection, RecordList } from "@/components/ui/list-row";
import { Switch } from "@/components/ui/switch";
import { type ComboServerActions, useManageCombos } from "@/components/use-manage-combos";
import type { BaseDessert, ModifierDessert } from "@/lib/combo-service";
import { formatINR } from "@/lib/format";
import type { ComboWithDetails } from "@/lib/types";

export type CombosManagerProps = {
	/** The signed-in role: picks the data source and catalog links; the layout is the same for both. */
	area: CatalogArea;
	initialCombos: Promise<ComboWithDetails[]>;
	baseDesserts: Promise<BaseDessert[]>;
	modifierDesserts: Promise<ModifierDessert[]>;
	/** Must be a module-level constant in the caller (stable identity). */
	actions: ComboServerActions;
};

function getDisplayPrice(combo: ComboWithDetails) {
	if (combo.overridePrice !== null) return combo.overridePrice;
	const modifierTotal = combo.items.reduce((sum, item) => sum + item.dessert.price * item.quantity, 0);
	return combo.baseDessert.price + modifierTotal;
}

/** "Choco Fudge Brownie + Nutella + 2× Oreo" */
function describeCombo(combo: ComboWithDetails) {
	const extras = combo.items.map((item) =>
		item.quantity > 1 ? `${item.quantity}× ${item.dessert.name}` : item.dessert.name,
	);
	return [combo.baseDessert.name, ...extras].join(" + ");
}

/** One Combos screen for admins and managers (DESIGN.md §Records). */
export function CombosManager({ area, initialCombos, baseDesserts, modifierDesserts, actions }: CombosManagerProps) {
	const {
		combos,
		filteredCombos,
		searchTerm,
		toggleLoadingIds,
		setSearchTerm,
		openCreateModal,
		openEditModal,
		handleToggle,
		getToggleFeedback,
		getSectionEnabled,
	} = useManageCombos({ role: area, initialCombos, baseDesserts, modifierDesserts, actions });
	const [filter, setFilter] = useState<CatalogFilter>("available");

	const onSaleCount = combos.filter(getSectionEnabled).length;
	const available = filteredCombos.filter(getSectionEnabled);
	const hidden = filteredCombos.filter((combo) => !getSectionEnabled(combo));
	const searching = searchTerm.trim() !== "";
	const visibleList = filter === "available" ? available : hidden;
	const showHiddenMatches = filter === "available" && searching && hidden.length > 0;

	const renderRow = (combo: ComboWithDetails) => {
		const feedback = getToggleFeedback(combo.id);
		const isHidden = !getSectionEnabled(combo);
		return (
			<ListRow
				key={combo.id}
				title={combo.name}
				meta={[describeCombo(combo), combo.overridePrice !== null ? "Custom price" : null, isHidden ? "Hidden" : null]
					.filter(Boolean)
					.join(" · ")}
				trailing={formatINR(getDisplayPrice(combo))}
				onClick={() => openEditModal(combo)}
				rowLabel={`Edit ${combo.name}`}
				action={
					<span className="flex h-11 items-center">
						<span className="relative inline-flex rounded-full">
							<Switch
								checked={combo.enabled}
								onCheckedChange={() => handleToggle(combo)}
								disabled={toggleLoadingIds.has(combo.id) || feedback.phase !== "idle"}
								aria-label={`Sell ${combo.name}`}
							/>
							<ActionFeedbackCheckOverlay phase={feedback.phase} announcement={feedback.announcement} />
						</span>
					</span>
				}
			/>
		);
	};

	return (
		<div className="w-full">
			<ComboFormDialog />

			<CatalogHeader
				area={area}
				onSale={onSaleCount}
				hidden={combos.length - onSaleCount}
				addLabel="Add combo"
				onAdd={openCreateModal}
			/>

			<div className="flex flex-col gap-3 pb-4">
				<CatalogSearch label="Search combos" placeholder="Search combos" value={searchTerm} onChange={setSearchTerm} />
				<CatalogFilterControl
					label="Show combos"
					value={filter}
					onValueChange={setFilter}
					availableCount={available.length}
					hiddenCount={hidden.length}
				/>
			</div>

			{visibleList.length > 0 ? (
				<RecordList aria-label={filter === "available" ? "Available combos" : "Hidden combos"}>
					{visibleList.map(renderRow)}
				</RecordList>
			) : (
				<CombosEmpty
					searchTerm={searchTerm}
					filter={filter}
					hiddenMatches={showHiddenMatches}
					onClearSearch={() => setSearchTerm("")}
					onAdd={openCreateModal}
				/>
			)}

			{showHiddenMatches ? (
				<ListSection title="Hidden" count={hidden.length} className="pt-6">
					<RecordList aria-label="Hidden combos matching your search">{hidden.map(renderRow)}</RecordList>
				</ListSection>
			) : null}
		</div>
	);
}

function CombosEmpty({
	searchTerm,
	filter,
	hiddenMatches,
	onClearSearch,
	onAdd,
}: {
	searchTerm: string;
	filter: CatalogFilter;
	hiddenMatches: boolean;
	onClearSearch: () => void;
	onAdd: () => void;
}) {
	const term = searchTerm.trim();
	if (hiddenMatches) return <EmptyState description={`No available combos match “${term}”.`} />;
	if (term) {
		return (
			<EmptyState
				title={`No combos match “${term}”`}
				description="Check the spelling or clear the search."
				action={
					<Button variant="outline" size="sm" onClick={onClearSearch}>
						Clear search
					</Button>
				}
			/>
		);
	}
	if (filter === "hidden") return <EmptyState description="No hidden combos. Every combo is on the Sell screen." />;
	return (
		<EmptyState
			variant="block"
			title="No combos on sale"
			description="A combo sells a dessert with its add-ons in one tap."
			action={
				<Button onClick={onAdd}>
					<Plus aria-hidden="true" />
					Add combo
				</Button>
			}
		/>
	);
}
