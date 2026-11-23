"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { FormSheet } from "@/components/ui/form-sheet";
import { useReactiveButton } from "@/components/ui/reactive-button";
import { formatINR } from "@/lib/format";
import type { ComboWithDetails } from "@/lib/types";
import { useComboStore } from "@/store/combo-store";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";

const COMBO_FORM_ID = "combo-form";

type ComboFormValues = ReturnType<typeof useComboStore.getState>["formData"];

/** The values the form opens with, to tell whether anything changed. */
function initialValuesFor(combo: ComboWithDetails | null): ComboFormValues {
	if (!combo) return { name: "", baseDessertId: null, overridePrice: "", enabled: true, items: [] };
	return {
		name: combo.name,
		baseDessertId: combo.baseDessertId,
		overridePrice: combo.overridePrice?.toString() ?? "",
		enabled: combo.enabled,
		items: combo.items.map((item) => ({ dessertId: item.dessertId, quantity: item.quantity })),
	};
}

function isSameForm(a: ComboFormValues, b: ComboFormValues) {
	if (a.name !== b.name || a.baseDessertId !== b.baseDessertId) return false;
	if (a.overridePrice !== b.overridePrice || a.enabled !== b.enabled) return false;
	if (a.items.length !== b.items.length) return false;
	const quantities = new Map(b.items.map((item) => [item.dessertId, item.quantity]));
	return a.items.every((item) => quantities.get(item.dessertId) === item.quantity);
}

export function ComboFormDialog() {
	const {
		openModal,
		editingCombo,
		formData,
		isLoading,
		bases,
		modifiers,
		closeModal,
		setFormField,
		toggleModifier,
		updateModifierQuantity,
		handleSubmit,
		handleDelete,
	} = useComboStore();
	const mountGenerationRef = useRef(0);

	useEffect(() => {
		const mountGeneration = ++mountGenerationRef.current;
		return () => {
			queueMicrotask(() => {
				if (mountGenerationRef.current === mountGeneration) closeModal();
			});
		};
	}, [closeModal]);

	const [submitButton, SubmitButton] = useReactiveButton({
		label: editingCombo ? "Save" : "Add",
		loading: { label: "Saving…" },
		success: { label: editingCombo ? "Updated" : "Added", duration: 900 },
		error: { label: "Failed to save" },
		feedbackStyle: "brand",
	});
	const [confirmDelete, setConfirmDelete] = useState(false);
	// Kept while the confirmation closes, after the store has cleared `editingCombo`.
	const [deleteName, setDeleteName] = useState("");
	const closeWithFeedbackCancellation = () => {
		submitButton.reset();
		setConfirmDelete(false);
		closeModal();
	};

	const isSubmitBusy = submitButton.status === "loading" || submitButton.status === "success";
	const isDeleteBusy = confirmDelete && isLoading;
	const dirty = !isSameForm(formData, initialValuesFor(editingCombo));

	const baseDessertLabel = useMemo(() => {
		const match = bases.find((b) => b.id === formData.baseDessertId);
		return match ? `${match.name} · ${formatINR(match.price)}` : null;
	}, [bases, formData.baseDessertId]);

	return (
		<>
			<FormSheet
				open={openModal}
				onOpenChange={(open) => {
					if (!open) closeWithFeedbackCancellation();
				}}
				title={editingCombo ? "Edit combo" : "Add combo"}
				dirty={dirty}
				busy={isLoading || submitButton.isBusy}
				primary={<SubmitButton type="submit" form={COMBO_FORM_ID} size="sm" disabled={isLoading || isDeleteBusy} />}
				menu={
					editingCombo ? (
						<DropdownMenuItem
							variant="destructive"
							onClick={() => {
								setDeleteName(editingCombo.name);
								setConfirmDelete(true);
							}}
						>
							<Trash2 aria-hidden="true" />
							Delete combo
						</DropdownMenuItem>
					) : null
				}
			>
				<form
					id={COMBO_FORM_ID}
					onSubmit={async (e) => {
						e.preventDefault();
						if (isLoading || isSubmitBusy || isDeleteBusy) return;
						if (!formData.name.trim()) {
							submitButton.setError("Name is required");
							return;
						}
						if (!formData.baseDessertId) {
							submitButton.setError("Base dessert is required");
							return;
						}
						const token = submitButton.setLoading();
						const result = await handleSubmit();
						if (!result.ok) {
							submitButton.setError("Failed to save", { token });
							return;
						}
						submitButton.setSuccess(undefined, { token, onComplete: closeModal });
					}}
					className="space-y-4"
				>
					<div className="space-y-2">
						<Label htmlFor="combo-name">Name</Label>
						<Input
							id="combo-name"
							value={formData.name}
							onChange={(e) => setFormField({ name: e.target.value })}
							placeholder="Brownie + ice cream"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="combo-base">Base dessert</Label>
						<Select
							value={formData.baseDessertId?.toString() ?? ""}
							onValueChange={(value) => setFormField({ baseDessertId: Number.parseInt(value || "", 10) })}
						>
							<SelectTrigger id="combo-base" className="w-full">
								<SelectValue placeholder="Select base dessert">{baseDessertLabel}</SelectValue>
							</SelectTrigger>
							<SelectContent className="min-w-64">
								{bases.map((dessert) => (
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
							value={formData.overridePrice}
							inputMode="numeric"
							onChange={(e) => setFormField({ overridePrice: e.target.value })}
							aria-describedby="combo-override-price-help"
						/>
						<p id="combo-override-price-help" className="text-[13px] text-muted-foreground">
							Leave empty to charge the base dessert plus its add-ons.
						</p>
					</div>

					<div className="flex min-h-11 items-center gap-3">
						<Switch
							id="combo-enabled"
							checked={formData.enabled}
							onCheckedChange={(checked) => setFormField({ enabled: checked })}
						/>
						<Label htmlFor="combo-enabled">Available on the Sell screen</Label>
					</div>

					<div className="space-y-2">
						<p className="text-sm leading-none font-medium">Add-ons</p>
						{modifiers.length === 0 ? (
							<div className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">
								No add-ons yet. Add a dessert with the type <strong>Add-on</strong>, then come back here.
							</div>
						) : (
							<div className="divide-y rounded-lg border bg-card">
								{modifiers.map((modifier) => {
									const selected = formData.items.find((i) => i.dessertId === modifier.id);
									return (
										<div key={modifier.id} className="flex min-h-12 items-center justify-between gap-3 px-3 py-1">
											<div className="flex min-w-0 items-center gap-3">
												<Checkbox
													id={`mod-${modifier.id}`}
													checked={!!selected}
													onCheckedChange={() => toggleModifier(modifier.id)}
												/>
												<Label htmlFor={`mod-${modifier.id}`} className="min-w-0 flex-wrap gap-x-1.5 text-sm leading-5">
													<span>{modifier.name}</span>
													<span className="font-normal text-muted-foreground tabular-nums">
														{formatINR(modifier.price)}
													</span>
												</Label>
											</div>
											{selected && (
												<Input
													type="number"
													inputMode="numeric"
													aria-label={`Quantity of ${modifier.name}`}
													min="1"
													max="10"
													value={selected.quantity}
													onChange={(e) =>
														updateModifierQuantity(modifier.id, Number.parseInt(e.target.value, 10) || 1)
													}
													className="w-16 shrink-0 text-center"
												/>
											)}
										</div>
									);
								})}
							</div>
						)}
					</div>
				</form>
			</FormSheet>
			<ConfirmSheet
				open={confirmDelete}
				onOpenChange={setConfirmDelete}
				title={`Delete ${deleteName}?`}
				description="It leaves the catalog and the Sell screen. Past orders aren't affected."
				confirmLabel="Delete combo"
				pendingLabel="Deleting…"
				onConfirm={async () => {
					// On success the store closes the form and the combo leaves the list.
					const result = await handleDelete();
					if (!result.ok) throw new Error("Couldn't delete this combo. Try again.");
					submitButton.reset();
				}}
			/>
		</>
	);
}
