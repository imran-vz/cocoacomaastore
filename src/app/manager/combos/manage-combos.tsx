"use client";

import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { use, useCallback, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ComboWithDetails } from "@/lib/types";
import {
	type BaseDessert,
	type ModifierDessert,
	createCombo,
	deleteCombo,
	getCachedAllCombos,
	toggleCombo,
	updateCombo,
	updateComboItems,
} from "./actions";
import { cn } from "@/lib/utils";

interface ComboFormData {
	name: string;
	baseDessertId: number | null;
	overridePrice: string;
	enabled: boolean;
	items: Array<{ dessertId: number; quantity: number }>;
}

const initialFormData: ComboFormData = {
	name: "",
	baseDessertId: null,
	overridePrice: "",
	enabled: true,
	items: [],
};

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

	const [combos, setCombos] = useState<ComboWithDetails[]>(initial);
	const [openModal, setOpenModal] = useState(false);
	const [editingCombo, setEditingCombo] = useState<ComboWithDetails | null>(
		null,
	);
	const [formData, setFormData] = useState<ComboFormData>(initialFormData);
	const [isLoading, setIsLoading] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const [toggleLoadingIds, setToggleLoadingIds] = useState<Set<number>>(
		new Set(),
	);

	const refetch = useCallback(() => {
		getCachedAllCombos().then(setCombos);
	}, []);

	const handleOpenModal = (combo?: ComboWithDetails) => {
		if (combo) {
			setEditingCombo(combo);
			setFormData({
				name: combo.name,
				baseDessertId: combo.baseDessertId,
				overridePrice: combo.overridePrice?.toString() ?? "",
				enabled: combo.enabled,
				items: combo.items.map((item) => ({
					dessertId: item.dessertId,
					quantity: item.quantity,
				})),
			});
		} else {
			setEditingCombo(null);
			setFormData(initialFormData);
		}
		setOpenModal(true);
	};

	const handleCloseModal = () => {
		setOpenModal(false);
		setEditingCombo(null);
		setFormData(initialFormData);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!formData.name.trim()) {
			toast.error("Name is required");
			return;
		}

		if (!formData.baseDessertId) {
			toast.error("Base dessert is required");
			return;
		}

		setIsLoading(true);
		try {
			const overridePrice = formData.overridePrice
				? Number.parseInt(formData.overridePrice, 10)
				: null;

			if (editingCombo) {
				await updateCombo(editingCombo.id, {
					name: formData.name.trim(),
					baseDessertId: formData.baseDessertId,
					overridePrice,
					enabled: formData.enabled,
				});
				await updateComboItems(editingCombo.id, formData.items);
			} else {
				const newCombo = await createCombo({
					name: formData.name.trim(),
					baseDessertId: formData.baseDessertId,
					overridePrice,
					enabled: formData.enabled,
				});
				if (formData.items.length > 0) {
					await updateComboItems(newCombo.id, formData.items);
				}
			}

			await refetch();
			handleCloseModal();
			toast.success(editingCombo ? "Combo updated" : "Combo created");
		} catch (error) {
			console.error("Failed to save combo:", error);
			toast.error("Failed to save combo");
		} finally {
			setIsLoading(false);
		}
	};

	const handleDelete = async () => {
		if (!editingCombo) return;

		setIsLoading(true);
		try {
			await deleteCombo(editingCombo.id);
			await refetch();
			handleCloseModal();
			toast.success("Combo deleted");
		} catch (error) {
			console.error("Failed to delete combo:", error);
			toast.error("Failed to delete combo");
		} finally {
			setIsLoading(false);
		}
	};

	const handleToggleCombo = async (combo: ComboWithDetails) => {
		const newEnabled = !combo.enabled;
		setToggleLoadingIds((prev) => new Set(prev).add(combo.id));

		// Optimistic update
		setCombos((prev) =>
			prev.map((c) => (c.id === combo.id ? { ...c, enabled: newEnabled } : c)),
		);

		try {
			await toggleCombo(combo.id, newEnabled);
			await refetch();
			toast.success(`Combo ${newEnabled ? "enabled" : "disabled"}`);
		} catch (error) {
			console.error("Failed to toggle combo:", error);
			toast.error("Failed to toggle combo");
			// Revert optimistic update
			setCombos((prev) =>
				prev.map((c) =>
					c.id === combo.id ? { ...c, enabled: !newEnabled } : c,
				),
			);
		} finally {
			setToggleLoadingIds((prev) => {
				const next = new Set(prev);
				next.delete(combo.id);
				return next;
			});
		}
	};

	const handleItemCheck = (
		modifierId: number,
		checked: boolean | "indeterminate",
	) => {
		setFormData((prev) => {
			if (checked) {
				// Add item with quantity 1 if not exists
				if (!prev.items.some((i) => i.dessertId === modifierId)) {
					return {
						...prev,
						items: [...prev.items, { dessertId: modifierId, quantity: 1 }],
					};
				}
			} else {
				// Remove item
				return {
					...prev,
					items: prev.items.filter((i) => i.dessertId !== modifierId),
				};
			}
			return prev;
		});
	};

	const handleItemQuantityChange = (modifierId: number, quantity: string) => {
		const qty = Number.parseInt(quantity, 10);
		if (Number.isNaN(qty) || qty < 1) return;

		setFormData((prev) => ({
			...prev,
			items: prev.items.map((i) =>
				i.dessertId === modifierId ? { ...i, quantity: qty } : i,
			),
		}));
	};

	const filteredCombos = combos.filter((combo) =>
		combo.name.toLowerCase().includes(searchTerm.toLowerCase()),
	);

	return (
		<div className="space-y-6">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<h1 className="text-2xl font-bold">Manage Combos</h1>
				<Button onClick={() => handleOpenModal()} size="sm">
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
					<Card
						key={combo.id}
						className={cn("gap-0", !combo.enabled ? "opacity-60 bg-muted" : "")}
					>
						<CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
							<CardTitle className="text-base font-semibold">
								{combo.name}
							</CardTitle>
							<div className="flex items-center gap-2">
								<Switch
									checked={combo.enabled}
									onCheckedChange={() => handleToggleCombo(combo)}
									disabled={toggleLoadingIds.has(combo.id)}
									aria-label="Toggle combo"
								/>
								<Button
									variant="ghost"
									size="icon"
									className="size-8"
									onClick={() => handleOpenModal(combo)}
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
									{combo.overridePrice
										? `₹${combo.overridePrice} (Override)`
										: "Auto-calculated"}
								</p>
								<div className="mt-2">
									<p className="font-medium text-foreground text-xs mb-1">
										Items:
									</p>
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

			<Dialog open={openModal} onOpenChange={setOpenModal}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{editingCombo ? "Edit Combo" : "Create New Combo"}
						</DialogTitle>
					</DialogHeader>

					<form onSubmit={handleSubmit} className="space-y-6">
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="name">Combo Name</Label>
								<Input
									id="name"
									value={formData.name}
									onChange={(e) =>
										setFormData((prev) => ({ ...prev, name: e.target.value }))
									}
									placeholder="e.g. Chocolate Explosion"
									required
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="baseDessert">Base Dessert</Label>
								<Select
									value={formData.baseDessertId?.toString() ?? ""}
									onValueChange={(val) =>
										setFormData((prev) => ({
											...prev,
											baseDessertId: Number.parseInt(val, 10),
										}))
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select base dessert" />
									</SelectTrigger>
									<SelectContent>
										{bases.map((base) => (
											<SelectItem key={base.id} value={base.id.toString()}>
												{base.name} (₹{base.price})
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label htmlFor="overridePrice">
									Override Price (Optional) (₹)
								</Label>
								<Input
									id="overridePrice"
									type="number"
									min="0"
									step="1"
									value={formData.overridePrice}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											overridePrice: e.target.value,
										}))
									}
									placeholder="Leave empty for auto-calc"
								/>
							</div>

							<div className="space-y-2 flex flex-col justify-end pb-2">
								<div className="flex items-center space-x-2">
									<Switch
										id="enabled"
										checked={formData.enabled}
										onCheckedChange={(checked) =>
											setFormData((prev) => ({ ...prev, enabled: checked }))
										}
									/>
									<Label htmlFor="enabled">Enabled</Label>
								</div>
							</div>
						</div>

						<div className="space-y-3">
							<Label>Combo Items (Modifiers)</Label>
							<div className="border rounded-md divide-y max-h-[300px] overflow-y-auto">
								{modifiers.map((modifier) => {
									const selectedItem = formData.items.find(
										(i) => i.dessertId === modifier.id,
									);
									const isSelected = !!selectedItem;

									return (
										<div
											key={modifier.id}
											className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
										>
											<div className="flex items-center space-x-3">
												<Checkbox
													id={`mod-${modifier.id}`}
													checked={isSelected}
													onCheckedChange={(checked) =>
														handleItemCheck(modifier.id, checked)
													}
												/>
												<div className="grid gap-0.5">
													<Label
														htmlFor={`mod-${modifier.id}`}
														className="font-medium cursor-pointer"
													>
														{modifier.name}
													</Label>
													<span className="text-xs text-muted-foreground">
														+₹{modifier.price}
													</span>
												</div>
											</div>

											{isSelected && (
												<div className="flex items-center gap-2">
													<Label
														htmlFor={`qty-${modifier.id}`}
														className="text-xs"
													>
														Qty:
													</Label>
													<Input
														id={`qty-${modifier.id}`}
														type="number"
														min="1"
														className="h-8 w-16"
														value={selectedItem.quantity}
														onChange={(e) =>
															handleItemQuantityChange(
																modifier.id,
																e.target.value,
															)
														}
													/>
												</div>
											)}
										</div>
									);
								})}
							</div>
						</div>

						<div className="flex justify-between gap-4 pt-4 border-t">
							{editingCombo ? (
								<Button
									type="button"
									variant="destructive"
									onClick={handleDelete}
									disabled={isLoading}
								>
									<Trash2 className="size-4 mr-2" />
									Delete
								</Button>
							) : (
								<div />
							)}
							<div className="flex gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={handleCloseModal}
									disabled={isLoading}
								>
									Cancel
								</Button>
								<Button type="submit" disabled={isLoading}>
									{isLoading && <span className="mr-2 animate-spin">⏳</span>}
									{editingCombo ? "Save Changes" : "Create Combo"}
								</Button>
							</div>
						</div>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
