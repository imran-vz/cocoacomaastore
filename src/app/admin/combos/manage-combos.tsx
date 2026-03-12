"use client";

import { Package, Pencil, Plus } from "lucide-react";
import { use, useEffect } from "react";

import { ComboFormDialog } from "@/components/combo-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { ComboWithDetails } from "@/lib/types";
import { useComboStore } from "@/store/combo-store";
import {
	type BaseDessert,
	createCombo,
	deleteCombo,
	getCachedAllCombos,
	type ModifierDessert,
	toggleCombo,
	updateCombo,
	updateComboItems,
} from "./actions";

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
	const initial = use(initialCombos);
	const bases = use(baseDesserts);
	const modifiers = use(modifierDesserts);

	const { combos, searchTerm, toggleLoadingIds, init, setSearchTerm, openCreateModal, openEditModal, handleToggle } =
		useComboStore();

	useEffect(() => {
		init(initial, bases, modifiers, {
			createCombo,
			updateCombo,
			deleteCombo,
			toggleCombo,
			updateComboItems,
			refetchCombos: getCachedAllCombos,
		});
	}, [initial, bases, modifiers, init]);

	const filteredCombos = combos.filter((combo) => combo.name.toLowerCase().includes(searchTerm.toLowerCase()));
	const enabledCombos = filteredCombos.filter((c) => c.enabled);
	const disabledCombos = filteredCombos.filter((c) => !c.enabled);

	return (
		<div className="@container/combos">
			<div className="space-y-4 @md/combos:space-y-6 p-2 @sm/combos:p-4 @md/combos:p-0">
				<ComboFormDialog />

				<div className="flex flex-col space-y-3 @md/combos:flex-row @md/combos:justify-between @md/combos:items-center @md/combos:space-y-0">
					<h2 className="text-xl @sm/combos:text-2xl font-bold">Combos</h2>
					<Button onClick={openCreateModal} size="sm">
						<Plus className="size-4 mr-2" />
						Add Combo
					</Button>
				</div>

				<Input
					placeholder="Search combos..."
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
					className="max-w-sm"
				/>

				{enabledCombos.length > 0 && (
					<div>
						<h3 className="text-lg font-semibold mb-4 text-green-700">Active Combos ({enabledCombos.length})</h3>
						<div className="grid grid-cols-1 @sm/combos:grid-cols-2 @lg/combos:grid-cols-3 gap-4">
							{enabledCombos.map((combo) => (
								<Card key={combo.id} className="relative gap-0">
									<CardHeader className="pb-2">
										<div className="flex items-start justify-between">
											<div className="flex items-center gap-2">
												<Package className="size-5 text-primary" />
												<CardTitle className="text-base">{combo.name}</CardTitle>
											</div>
											<div className="flex items-center gap-1">
												<Button
													variant="ghost"
													size="icon"
													className="size-8"
													onClick={() => openEditModal(combo)}
												>
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
									<CardContent className="text-sm text-muted-foreground">
										<p className="mb-1">
											Base: <span className="font-medium">{combo.baseDessert.name}</span>
										</p>
										{combo.items.length > 0 && (
											<p className="mb-2 text-xs">
												+{" "}
												{combo.items
													.map((item) =>
														item.quantity > 1
															? `${item.quantity}× ${item.dessert.name}`
															: item.dessert.name,
													)
													.join(", ")}
											</p>
										)}
										<p className="font-semibold text-foreground">
											₹{getDisplayPrice(combo)}
											{combo.overridePrice !== null && (
												<span className="text-xs text-muted-foreground ml-1">(override)</span>
											)}
										</p>
									</CardContent>
								</Card>
							))}
						</div>
					</div>
				)}

				{disabledCombos.length > 0 && (
					<div>
						<h3 className="text-lg font-semibold mb-4 text-red-700">
							Disabled Combos ({disabledCombos.length})
						</h3>
						<div className="grid grid-cols-1 @sm/combos:grid-cols-2 @lg/combos:grid-cols-3 gap-4">
							{disabledCombos.map((combo) => (
								<Card key={combo.id} className="relative opacity-60">
									<CardHeader className="pb-2">
										<div className="flex items-start justify-between">
											<div className="flex items-center gap-2">
												<Package className="size-5 text-muted-foreground" />
												<CardTitle className="text-base">{combo.name}</CardTitle>
											</div>
											<div className="flex items-center gap-1">
												<Button
													variant="ghost"
													size="icon"
													className="size-8"
													onClick={() => openEditModal(combo)}
												>
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
									<CardContent className="text-sm text-muted-foreground">
										<p className="mb-1">
											Base: <span className="font-medium">{combo.baseDessert.name}</span>
										</p>
										{combo.items.length > 0 && (
											<p className="mb-2 text-xs">
												+{" "}
												{combo.items
													.map((item) =>
														item.quantity > 1
															? `${item.quantity}× ${item.dessert.name}`
															: item.dessert.name,
													)
													.join(", ")}
											</p>
										)}
										<p className="font-semibold text-foreground">₹{getDisplayPrice(combo)}</p>
									</CardContent>
								</Card>
							))}
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
