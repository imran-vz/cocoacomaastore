"use client";

import { Package, Pencil, Plus } from "lucide-react";
import { use, useEffect } from "react";

import { ComboFormDialog } from "@/components/combo-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { ComboWithDetails } from "@/lib/types";
import { cn } from "@/lib/utils";
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

	return (
		<div className="space-y-6">
			<ComboFormDialog />

			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<h1 className="text-2xl font-bold">Manage Combos</h1>
				<Button onClick={openCreateModal} size="sm">
					<Plus className="size-4 mr-2" />
					New Combo
				</Button>
			</div>

			<Input
				placeholder="Search combos..."
				value={searchTerm}
				onChange={(e) => setSearchTerm(e.target.value)}
				className="max-w-sm"
			/>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{filteredCombos.map((combo) => (
					<Card key={combo.id} className={cn("gap-0", !combo.enabled && "opacity-60 bg-muted")}>
						<CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
							<CardTitle className="text-base font-semibold">{combo.name}</CardTitle>
							<div className="flex items-center gap-2">
								<Switch
									checked={combo.enabled}
									onCheckedChange={() => handleToggle(combo)}
									disabled={toggleLoadingIds.has(combo.id)}
									aria-label="Toggle combo"
								/>
								<Button
									variant="ghost"
									size="icon"
									className="size-8"
									onClick={() => openEditModal(combo)}
								>
									<Pencil className="size-4" />
									<span className="sr-only">Edit combo</span>
								</Button>
							</div>
						</CardHeader>
						<CardContent>
							<div className="text-sm text-muted-foreground space-y-1">
								<p>Base: {combo.baseDessert.name}</p>
								<p>
									Price:{" "}
									{combo.overridePrice ? `₹${combo.overridePrice} (Override)` : "Auto-calculated"}
								</p>
								<div className="mt-2">
									<p className="font-medium text-foreground text-xs mb-1">Items:</p>
									<div className="flex flex-wrap gap-1">
										{combo.items.length > 0 ? (
											combo.items.map((item) => (
												<span
													key={item.dessertId}
													className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground"
												>
													{item.quantity}x {item.dessert.name}
												</span>
											))
										) : (
											<span className="text-xs italic">No items</span>
										)}
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				))}
				{filteredCombos.length === 0 && (
					<div className="col-span-full text-center py-12 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
						<Package className="size-10 mx-auto mb-3 opacity-20" />
						<p className="font-medium">No combos found</p>
					</div>
				)}
			</div>
		</div>
	);
}
