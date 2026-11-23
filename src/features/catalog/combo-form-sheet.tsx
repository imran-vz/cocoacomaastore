"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { FormSheet, useFormSheet } from "@/components/ui/form-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { deleteCombo, saveCombo } from "@/features/catalog/actions";
import {
	type ComboFormValues,
	formChoices,
	isSameForm,
	removedDesserts,
	setAddOnQuantity,
	toComboInput,
	toFormValues,
	toggleAddOn,
} from "@/features/catalog/combo-form";
import type { ComboCatalog, ComboWithDetails } from "@/features/catalog/queries";
import { removedFromCatalog } from "@/features/catalog/rules";
import { COMBO_ADD_ON_MAX_QUANTITY } from "@/features/catalog/schemas";
import { formatINR } from "@/lib/format";

type ComboChoices = Pick<ComboCatalog, "bases" | "addOns">;

/** Adds a combo (`combo` is `null`) or edits one, with Delete in its `⋯` menu. */
export function ComboFormSheet({
	open,
	onOpenChange,
	combo,
	catalog,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	combo: ComboWithDetails | null;
	catalog: ComboChoices;
}) {
	return (
		<FormSheet
			open={open}
			onOpenChange={onOpenChange}
			title={combo ? "Edit combo" : "Add combo"}
			submitLabel={combo ? "Save" : "Add"}
			savedLabel={combo ? "Updated" : "Added"}
			onDelete={combo ? () => deleteCombo(combo.id) : undefined}
			deleteLabel="Delete combo"
			deleteTitle={`Delete ${combo?.name ?? "combo"}?`}
			deleteDescription="It leaves the catalog and the Sell screen. Past orders aren't affected."
		>
			<ComboFields combo={combo} catalog={catalog} />
		</FormSheet>
	);
}

function ComboFields({ combo, catalog }: { combo: ComboWithDetails | null; catalog: ComboChoices }) {
	const [initial] = useState(() => toFormValues(combo));
	const [values, setValues] = useState(initial);
	const removed = removedDesserts(combo);
	const choices = formChoices(catalog, combo);
	useFormSheet({
		// The form already leaves out removed desserts, so saving it as it opens changes the combo.
		dirty: removed.length > 0 || !isSameForm(values, initial),
		onSave: async () => {
			const request = toComboInput(values, combo?.id);
			return request.ok ? saveCombo(request.input) : request;
		},
	});
	const update = (changes: Partial<ComboFormValues>) => setValues((current) => ({ ...current, ...changes }));

	const base = choices.bases.find(({ id }) => id === values.baseDessertId);
	const baseLabel = base ? `${base.name} · ${formatINR(base.price)}` : null;

	return (
		<>
			{removed.length > 0 ? (
				<p className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">
					{removedFromCatalog(removed)}, so this combo is not on sale. Pick a replacement if needed, then save.
				</p>
			) : null}
			<div className="space-y-2">
				<Label htmlFor="combo-name">Name</Label>
				<Input
					id="combo-name"
					value={values.name}
					onChange={(event) => update({ name: event.target.value })}
					placeholder="Brownie + ice cream"
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="combo-base">Base dessert</Label>
				<Select
					value={values.baseDessertId?.toString() ?? ""}
					onValueChange={(value) => update({ baseDessertId: value ? Number.parseInt(value, 10) : null })}
				>
					<SelectTrigger id="combo-base" className="w-full">
						<SelectValue placeholder="Select base dessert">{baseLabel}</SelectValue>
					</SelectTrigger>
					<SelectContent className="min-w-64">
						{choices.bases.map((dessert) => (
							<SelectItem key={dessert.id} value={dessert.id.toString()}>
								{dessert.name} · {formatINR(dessert.price)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="space-y-2">
				<Label htmlFor="combo-override-price">Price override</Label>
				<Input
					id="combo-override-price"
					type="number"
					min="0"
					value={values.overridePrice}
					inputMode="numeric"
					onChange={(event) => update({ overridePrice: event.target.value })}
					aria-describedby="combo-override-price-help"
				/>
				<p id="combo-override-price-help" className="text-meta text-muted-foreground">
					Leave empty to charge the base dessert plus its add-ons.
				</p>
			</div>

			<div className="flex min-h-11 items-center gap-3">
				<Switch
					id="combo-enabled"
					checked={values.enabled}
					onCheckedChange={(checked) => update({ enabled: checked })}
				/>
				<Label htmlFor="combo-enabled">Available on the Sell screen</Label>
			</div>

			<div className="space-y-2">
				<p className="text-sm leading-none font-medium">Add-ons</p>
				{choices.addOns.length === 0 ? (
					<div className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">
						No add-ons yet. Add a dessert with the type <strong>Add-on</strong>, then come back here.
					</div>
				) : (
					<div className="divide-y rounded-lg border bg-card">
						{choices.addOns.map((addOn) => {
							const picked = values.addOns.find(({ dessertId }) => dessertId === addOn.id);
							return (
								<div key={addOn.id} className="flex min-h-12 items-center justify-between gap-3 px-3 py-1">
									<div className="flex min-w-0 items-center gap-3">
										<Checkbox
											id={`add-on-${addOn.id}`}
											checked={Boolean(picked)}
											onCheckedChange={() => setValues((current) => toggleAddOn(current, addOn.id))}
										/>
										<Label htmlFor={`add-on-${addOn.id}`} className="min-w-0 flex-wrap gap-x-1.5 text-sm leading-5">
											<span>{addOn.name}</span>
											<span className="font-normal text-muted-foreground tabular-nums">{formatINR(addOn.price)}</span>
										</Label>
									</div>
									{picked ? (
										<Input
											type="number"
											inputMode="numeric"
											aria-label={`Quantity of ${addOn.name}`}
											min="1"
											max={COMBO_ADD_ON_MAX_QUANTITY}
											value={picked.quantity}
											onChange={(event) => {
												const quantity = Number.parseInt(event.target.value, 10) || 1;
												if (quantity >= 1) setValues((current) => setAddOnQuantity(current, addOn.id, quantity));
											}}
											className="w-16 shrink-0 text-center"
										/>
									) : null}
								</div>
							);
						})}
					</div>
				)}
			</div>
		</>
	);
}
