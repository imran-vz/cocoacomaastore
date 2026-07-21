"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { useReactiveButton } from "@/components/ui/reactive-button";

import { useComboStore } from "@/store/combo-store";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";

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
		label: editingCombo ? "Update" : "Create",
		loading: { label: "Saving..." },
		success: { label: editingCombo ? "Updated" : "Created", duration: 900 },
		error: { label: "Failed to save" },
		feedbackStyle: "brand",
	});
	const [deleteButton, DeleteButton] = useReactiveButton({
		label: "Delete",
		icon: Trash2,
		loading: { label: "Deleting..." },
		error: { label: "Delete failed" },
	});
	const closeWithFeedbackCancellation = () => {
		submitButton.reset();
		deleteButton.reset();
		closeModal();
	};

	const isSubmitBusy = submitButton.status === "loading" || submitButton.status === "success";
	const isDeleteBusy = deleteButton.status === "loading";

	const baseDessertLabel = useMemo(() => {
		const match = bases.find((b) => b.id === formData.baseDessertId);
		return match ? `${match.name} (₹${match.price})` : null;
	}, [bases, formData.baseDessertId]);

	return (
		<Dialog
			open={openModal}
			onOpenChange={(open) => {
				if (!open) closeWithFeedbackCancellation();
			}}
		>
			<DialogContent className="mx-2 max-w-[calc(100vw-1rem)] sm:mx-4 sm:max-w-[calc(100vw-2rem)] md:max-w-lg md:mx-0 max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{editingCombo ? "Edit Combo" : "Add New Combo"}</DialogTitle>
				</DialogHeader>
				<form
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
						<Label htmlFor="combo-name">Combo Name</Label>
						<Input
							id="combo-name"
							value={formData.name}
							onChange={(e) => setFormField({ name: e.target.value })}
							placeholder="e.g., Brownie + Ice Cream"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="combo-base">Base Dessert</Label>
						<Select
							value={formData.baseDessertId?.toString() ?? ""}
							onValueChange={(value) => setFormField({ baseDessertId: Number.parseInt(value || "", 10) })}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Select base dessert">{baseDessertLabel}</SelectValue>
							</SelectTrigger>
							<SelectContent className="min-w-64">
								{bases.map((dessert) => (
									<SelectItem key={dessert.id} value={dessert.id.toString()}>
										{dessert.name} (₹{dessert.price})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="combo-override-price">Override Price (leave empty to compute)</Label>
						<Input
							id="combo-override-price"
							type="number"
							min="0"
							value={formData.overridePrice}
							onChange={(e) => setFormField({ overridePrice: e.target.value })}
							placeholder="e.g., 150"
						/>
					</div>

					<div className="flex items-center gap-2">
						<Switch
							id="combo-enabled"
							checked={formData.enabled}
							onCheckedChange={(checked) => setFormField({ enabled: checked })}
						/>
						<Label htmlFor="combo-enabled">Enabled</Label>
					</div>

					<div className="space-y-2">
						<Label>Modifiers (Add-ons)</Label>
						{modifiers.length === 0 ? (
							<div className="border rounded-md p-3 text-sm text-muted-foreground">
								No modifier desserts found. Create a dessert with Type = <strong>Modifier (Add-on)</strong>, then come
								back here.
							</div>
						) : (
							<div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
								{modifiers.map((modifier) => {
									const selected = formData.items.find((i) => i.dessertId === modifier.id);
									return (
										<div key={modifier.id} className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												<Checkbox
													id={`mod-${modifier.id}`}
													checked={!!selected}
													onCheckedChange={() => toggleModifier(modifier.id)}
												/>
												<Label htmlFor={`mod-${modifier.id}`} className="text-sm">
													{modifier.name} (₹{modifier.price})
												</Label>
											</div>
											{selected && (
												<Input
													type="number"
													min="1"
													max="10"
													value={selected.quantity}
													onChange={(e) =>
														updateModifierQuantity(modifier.id, Number.parseInt(e.target.value, 10) || 1)
													}
													className="w-16 h-8 text-sm"
												/>
											)}
										</div>
									);
								})}
							</div>
						)}
					</div>

					<div className="flex gap-2 pt-2">
						{editingCombo && (
							<DeleteButton
								type="button"
								variant="destructive"
								disabled={isLoading || isSubmitBusy}
								onClick={async () => {
									if (isLoading || isSubmitBusy || isDeleteBusy) return;
									const token = deleteButton.setLoading();
									const result = await handleDelete();
									// On success the store closes the dialog and the combo leaves the
									// list — the disappearance is the feedback, so no success flash.
									if (!result.ok) {
										deleteButton.setError("Delete failed", { token });
									}
								}}
							/>
						)}
						<Button type="button" variant="outline" onClick={closeWithFeedbackCancellation} className="ml-auto">
							Cancel
						</Button>
						<SubmitButton type="submit" disabled={isLoading || isDeleteBusy} />
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
