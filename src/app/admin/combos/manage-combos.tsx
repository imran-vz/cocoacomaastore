"use client";

import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
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
		const newEnabledState = !combo.enabled;

		setToggleLoadingIds((prev) => new Set(prev).add(combo.id));
		setCombos((prev) =>
			prev.map((c) =>
				c.id === combo.id ? { ...c, enabled: newEnabledState } : c,
			),
		);

		try {
			await toggleCombo(combo.id, newEnabledState);
			toast.success(`Combo ${newEnabledState ? "enabled" : "disabled"}`);
		} catch (error) {
			console.error("Failed to toggle combo:", error);
			toast.error("Failed to toggle combo");
			setCombos((prev) =>
				prev.map((c) =>
					c.id === combo.id ? { ...c, enabled: combo.enabled } : c,
				),
			);
		} finally {
			setToggleLoadingIds((prev) => {
				const newSet = new Set(prev);
				newSet.delete(combo.id);
				return newSet;
			});
			await refetch();
		}
	};

	const toggleModifier = (dessertId: number) => {
		setFormData((prev) => {
			const existing = prev.items.find((i) => i.dessertId === dessertId);
			if (existing) {
				return {
					...prev,
					items: prev.items.filter((i) => i.dessertId !== dessertId),
				};
			}
			return {
				...prev,
				items: [...prev.items, { dessertId, quantity: 1 }],
			};
		});
	};

	const updateModifierQuantity = (dessertId: number, quantity: number) => {
		if (quantity < 1) return;
		setFormData((prev) => ({
			...prev,
			items: prev.items.map((item) =>
				item.dessertId === dessertId ? { ...item, quantity } : item,
			),
		}));
	};

	const filteredCombos = combos.filter((combo) =>
		combo.name.toLowerCase().includes(searchTerm.toLowerCase()),
	);

	const enabledCombos = filteredCombos.filter((c) => c.enabled);
	const disabledCombos = filteredCombos.filter((c) => !c.enabled);

	// Compute display price for a combo
	const getDisplayPrice = (combo: ComboWithDetails) => {
		if (combo.overridePrice !== null) return combo.overridePrice;
		const modifierTotal = combo.items.reduce(
			(sum, item) => sum + item.dessert.price * item.quantity,
			0,
		);
		return combo.baseDessert.price + modifierTotal;
	};

	return (
		<div className="@container/combos">
			<div className="space-y-4 @md/combos:space-y-6 p-2 @sm/combos:p-4 @md/combos:p-0">
				<Dialog open={openModal} onOpenChange={handleCloseModal}>
					<DialogContent className="mx-2 max-w-[calc(100vw-1rem)] sm:mx-4 sm:max-w-[calc(100vw-2rem)] md:max-w-lg md:mx-0 max-h-[90vh] overflow-y-auto">
						<DialogHeader>
							<DialogTitle>
								{editingCombo ? "Edit Combo" : "Add New Combo"}
							</DialogTitle>
						</DialogHeader>
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="name">Combo Name</Label>
								<Input
									id="name"
									value={formData.name}
									onChange={(e) =>
										setFormData((prev) => ({ ...prev, name: e.target.value }))
									}
									placeholder="e.g., Brownie + Ice Cream"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="baseDessert">Base Dessert</Label>
								<Select
									value={formData.baseDessertId?.toString() ?? ""}
									onValueChange={(value) =>
										setFormData((prev) => ({
											...prev,
											baseDessertId: Number.parseInt(value, 10),
										}))
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select base dessert" />
									</SelectTrigger>
									<SelectContent>
										{bases.map((dessert) => (
											<SelectItem
												key={dessert.id}
												value={dessert.id.toString()}
											>
												{dessert.name} (₹{dessert.price})
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label htmlFor="overridePrice">
									Override Price (leave empty to compute)
								</Label>
								<Input
									id="overridePrice"
									type="number"
									min="0"
									value={formData.overridePrice}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											overridePrice: e.target.value,
										}))
									}
									placeholder="e.g., 150"
								/>
							</div>

							<div className="flex items-center gap-2">
								<Switch
									id="enabled"
									checked={formData.enabled}
									onCheckedChange={(checked) =>
										setFormData((prev) => ({ ...prev, enabled: checked }))
									}
								/>
								<Label htmlFor="enabled">Enabled</Label>
							</div>

							<div className="space-y-2">
								<div className="flex items-center justify-between gap-2">
									<Label>Modifiers (Add-ons)</Label>
									{modifiers.length === 0 && (
										<Button asChild variant="outline" size="sm">
											<Link href="/admin/desserts">Create add-ons</Link>
										</Button>
									)}
								</div>

								{modifiers.length === 0 ? (
									<div className="border rounded-md p-3 text-sm text-muted-foreground">
										No modifier desserts found. In{" "}
										<strong>Admin → Desserts</strong>, create a dessert with
										Type = <strong>Modifier (Add-on)</strong>, then come back
										here.
									</div>
								) : (
									<div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
										{modifiers.map((modifier) => {
											const selected = formData.items.find(
												(i) => i.dessertId === modifier.id,
											);
											return (
												<div
													key={modifier.id}
													className="flex items-center justify-between"
												>
													<div className="flex items-center gap-2">
														<Checkbox
															id={`mod-${modifier.id}`}
															checked={!!selected}
															onCheckedChange={() =>
																toggleModifier(modifier.id)
															}
														/>
														<Label
															htmlFor={`mod-${modifier.id}`}
															className="text-sm"
														>
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
																updateModifierQuantity(
																	modifier.id,
																	Number.parseInt(e.target.value, 10) || 1,
																)
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
									<Button
										type="button"
										variant="destructive"
										onClick={handleDelete}
										disabled={isLoading}
									>
										<Trash2 className="size-4 mr-2" />
										Delete
									</Button>
								)}
								<Button
									type="button"
									variant="outline"
									onClick={handleCloseModal}
									className="ml-auto"
								>
									Cancel
								</Button>
								<Button type="submit" disabled={isLoading}>
									{isLoading ? "Saving..." : editingCombo ? "Update" : "Create"}
								</Button>
							</div>
						</form>
					</DialogContent>
				</Dialog>

				<div className="flex flex-col space-y-3 @md/combos:flex-row @md/combos:justify-between @md/combos:items-center @md/combos:space-y-0">
					<h2 className="text-xl @sm/combos:text-2xl font-bold">Combos</h2>
					<Button onClick={() => handleOpenModal()} size="sm">
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

				{/* Enabled Combos */}
				{enabledCombos.length > 0 && (
					<div>
						<h3 className="text-lg font-semibold mb-4 text-green-700">
							Active Combos ({enabledCombos.length})
						</h3>
						<div className="grid grid-cols-1 @sm/combos:grid-cols-2 @lg/combos:grid-cols-3 gap-4">
							{enabledCombos.map((combo) => (
								<Card key={combo.id} className="relative gap-0">
									<CardHeader className="pb-2">
										<div className="flex items-start justify-between">
											<div className="flex items-center gap-2">
												<Package className="size-5 text-primary" />
												<CardTitle className="text-base">
													{combo.name}
												</CardTitle>
											</div>
											<div className="flex items-center gap-1">
												<Button
													variant="ghost"
													size="icon"
													className="size-8"
													onClick={() => handleOpenModal(combo)}
												>
													<Pencil className="size-4" />
												</Button>
												<Switch
													checked={combo.enabled}
													onCheckedChange={() => handleToggleCombo(combo)}
													disabled={toggleLoadingIds.has(combo.id)}
												/>
											</div>
										</div>
									</CardHeader>
									<CardContent className="text-sm text-muted-foreground">
										<p className="mb-1">
											Base:{" "}
											<span className="font-medium">
												{combo.baseDessert.name}
											</span>
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
												<span className="text-xs text-muted-foreground ml-1">
													(override)
												</span>
											)}
										</p>
									</CardContent>
								</Card>
							))}
						</div>
					</div>
				)}

				{/* Disabled Combos */}
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
												<CardTitle className="text-base">
													{combo.name}
												</CardTitle>
											</div>
											<div className="flex items-center gap-1">
												<Button
													variant="ghost"
													size="icon"
													className="size-8"
													onClick={() => handleOpenModal(combo)}
												>
													<Pencil className="size-4" />
												</Button>
												<Switch
													checked={combo.enabled}
													onCheckedChange={() => handleToggleCombo(combo)}
													disabled={toggleLoadingIds.has(combo.id)}
												/>
											</div>
										</div>
									</CardHeader>
									<CardContent className="text-sm text-muted-foreground">
										<p className="mb-1">
											Base:{" "}
											<span className="font-medium">
												{combo.baseDessert.name}
											</span>
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
										</p>
									</CardContent>
								</Card>
							))}
						</div>
					</div>
				)}

				{/* Empty state */}
				{filteredCombos.length === 0 && (
					<div className="text-center py-12">
						<Package className="size-12 mx-auto text-muted-foreground opacity-50 mb-4" />
						<div className="text-muted-foreground mb-4">
							{searchTerm
								? "No combos found matching your search."
								: "No combos created yet."}
						</div>
						{!searchTerm && (
							<Button onClick={() => handleOpenModal()}>
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
