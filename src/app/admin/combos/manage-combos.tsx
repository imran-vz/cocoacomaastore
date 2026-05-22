"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Pencil, Plus } from "lucide-react";
import { use, useEffect } from "react";

import { ComboFormDialog } from "@/components/combo-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { BaseDessert, ModifierDessert } from "@/lib/combo-service";
import type { ComboWithDetails } from "@/lib/types";
import { useComboStore } from "@/store/combo-store";
import { createCombo, deleteCombo, toggleCombo, updateCombo, updateComboItems } from "./actions";

const combosQueryKey = ["admin-combos"] as const;

type CombosPayload = {
	combos: ComboWithDetails[];
	baseDesserts: BaseDessert[];
	modifierDesserts: ModifierDessert[];
};

async function fetchCombosPayload(signal?: AbortSignal): Promise<CombosPayload> {
	const response = await fetch("/api/admin/combos", {
		cache: "no-store",
		signal,
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch admin combos (${response.status})`);
	}

	return response.json();
}

function getDisplayPrice(combo: ComboWithDetails) {
	if (combo.overridePrice !== null) return combo.overridePrice;
	const modifierTotal = combo.items.reduce((sum, item) => sum + item.dessert.price * item.quantity, 0);
	return combo.baseDessert.price + modifierTotal;
}

export default function ManageCombos({
	initialCombos,
	baseDesserts,
	modifierDesserts,
}: {
	initialCombos: Promise<ComboWithDetails[]>;
	baseDesserts: Promise<BaseDessert[]>;
	modifierDesserts: Promise<ModifierDessert[]>;
}) {
	const initialPayload = {
		combos: use(initialCombos),
		baseDesserts: use(baseDesserts),
		modifierDesserts: use(modifierDesserts),
	};
	const queryClient = useQueryClient();
	const { data, error } = useQuery({
		queryKey: combosQueryKey,
		queryFn: ({ signal }) => fetchCombosPayload(signal),
		initialData: initialPayload,
		staleTime: 60_000,
		gcTime: 10 * 60_000,
	});

	const { combos, searchTerm, toggleLoadingIds, init, setSearchTerm, openCreateModal, openEditModal, handleToggle } =
		useComboStore();

	useEffect(() => {
		init(data.combos, data.baseDesserts, data.modifierDesserts, {
			createCombo,
			updateCombo,
			deleteCombo,
			toggleCombo,
			updateComboItems,
			refetchCombos: async () => {
				const latest = await queryClient.fetchQuery({
					queryKey: combosQueryKey,
					queryFn: ({ signal }) => fetchCombosPayload(signal),
					staleTime: 0,
				});
				return latest.combos;
			},
		});
	}, [data, init, queryClient]);

	if (error) {
		console.error("Failed to fetch admin combos:", error);
	}

	const filteredCombos = combos.filter((combo) => combo.name.toLowerCase().includes(searchTerm.toLowerCase()));
	const enabledCombos = filteredCombos.filter((c) => c.enabled);
	const disabledCombos = filteredCombos.filter((c) => !c.enabled);
	const renderComboCard = (combo: ComboWithDetails, isDisabled = false) => (
		<Card key={combo.id} className={isDisabled ? "relative gap-0 opacity-60" : "relative gap-0"}>
			<CardHeader className="pb-2">
				<div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
					<div className="flex min-w-0 items-start gap-2">
						<Package
							className={
								isDisabled ? "mt-1 size-4 shrink-0 text-muted-foreground" : "mt-1 size-4 shrink-0 text-primary"
							}
						/>
						<CardTitle className="min-w-0 text-base leading-snug wrap-break-word @md/combos:text-lg">
							{combo.name}
						</CardTitle>
					</div>
					<div className="flex shrink-0 items-center gap-1">
						<Button variant="ghost" size="icon" className="size-8" onClick={() => openEditModal(combo)}>
							<Pencil className="size-4" />
						</Button>
						<Switch
							checked={combo.enabled}
							onCheckedChange={() => handleToggle(combo)}
							disabled={toggleLoadingIds.has(combo.id)}
						/>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-2 text-sm text-muted-foreground">
				<p className="leading-relaxed">
					Base: <span className="font-medium text-foreground/80">{combo.baseDessert.name}</span>
				</p>
				{combo.items.length > 0 && (
					<p className="text-xs leading-relaxed">
						+{" "}
						{combo.items
							.map((item) => (item.quantity > 1 ? `${item.quantity}× ${item.dessert.name}` : item.dessert.name))
							.join(", ")}
					</p>
				)}
				<p className="text-base font-semibold text-foreground">
					₹{getDisplayPrice(combo)}
					{combo.overridePrice !== null && <span className="ml-1 text-xs text-muted-foreground">(override)</span>}
				</p>
			</CardContent>
		</Card>
	);

	return (
		<div className="@container/combos">
			<div className="space-y-4 p-0 @md/combos:space-y-6">
				<ComboFormDialog />

				<div className="flex flex-col gap-3 @md/combos:flex-row @md/combos:items-center @md/combos:justify-between">
					<h2 className="text-3xl font-bold tracking-tight @md/combos:text-2xl">Combos</h2>
					<Button onClick={openCreateModal} size="sm" className="w-full @md/combos:w-auto">
						<Plus className="size-4 mr-2" />
						Add Combo
					</Button>
				</div>

				<Input
					placeholder="Search combos..."
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
					className="w-full @md/combos:max-w-sm"
				/>

				{enabledCombos.length > 0 && (
					<div>
						<h3 className="text-lg font-semibold mb-4 text-green-700">Active Combos ({enabledCombos.length})</h3>
						<div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,24rem),1fr))] gap-4">
							{enabledCombos.map((combo) => renderComboCard(combo))}
						</div>
					</div>
				)}

				{disabledCombos.length > 0 && (
					<div>
						<h3 className="text-lg font-semibold mb-4 text-red-700">Disabled Combos ({disabledCombos.length})</h3>
						<div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,24rem),1fr))] gap-4">
							{disabledCombos.map((combo) => renderComboCard(combo, true))}
						</div>
					</div>
				)}

				{filteredCombos.length === 0 && (
					<div className="text-center py-12">
						<Package className="size-12 mx-auto text-muted-foreground opacity-50 mb-4" />
						<div className="text-muted-foreground mb-4">
							{searchTerm ? "No combos found matching your search." : "No combos created yet."}
						</div>
						{!searchTerm && (
							<Button onClick={openCreateModal}>
								<Plus className="size-4 mr-2" />
								Create Your First Combo
							</Button>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
