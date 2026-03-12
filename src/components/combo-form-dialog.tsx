"use client";

import { Trash2 } from "lucide-react";
import { useMemo } from "react";

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

	const baseDessertLabel = useMemo(() => {
		const match = bases.find((b) => b.id === formData.baseDessertId);
		return match ? `${match.name} (₹${match.price})` : null;
	}, [bases, formData.baseDessertId]);

	return (
		<Dialog open={openModal} onOpenChange={closeModal}>
			<DialogContent className="mx-2 max-w-[calc(100vw-1rem)] sm:mx-4 sm:max-w-[calc(100vw-2rem)] md:max-w-lg md:mx-0 max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{editingCombo ? "Edit Combo" : "Add New Combo"}</DialogTitle>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						handleSubmit();
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
							<Button type="button" variant="destructive" onClick={handleDelete} disabled={isLoading}>
								<Trash2 className="size-4 mr-2" />
								Delete
							</Button>
						)}
						<Button type="button" variant="outline" onClick={closeModal} className="ml-auto">
							Cancel
						</Button>
						<Button type="submit" disabled={isLoading}>
							{isLoading ? "Saving..." : editingCombo ? "Update" : "Create"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
