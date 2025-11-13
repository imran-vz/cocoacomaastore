"use client";

import { use, useCallback, useState } from "react";
import { toast } from "sonner";

import { DessertCard } from "@/components/dessert-card";
import { DessertForm } from "@/components/dessert-form";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Dessert } from "@/lib/types";
import {
	createDessert,
	deleteDessert,
	disableAllDesserts,
	getCachedDesserts,
	moveDessertToBottom,
	moveDessertToTop,
	toggleDessert,
	toggleOutOfStock,
	updateDessert,
	updateDessertSequence,
} from "./actions";

function capitalize(str: string) {
	return str
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

export default function ManageDesserts({
	initialDesserts,
}: {
	initialDesserts: Promise<Dessert[]>;
}) {
	const initial = use(initialDesserts);

	const [desserts, setDesserts] = useState<Dessert[]>(initial);
	const [editingDessert, setEditingDessert] = useState<Dessert | null>(null);
	const [openModal, setOpenModal] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const [toggleLoadingIds, setToggleLoadingIds] = useState<Set<number>>(
		new Set(),
	);
	const [stockToggleLoadingIds, setStockToggleLoadingIds] = useState<
		Set<number>
	>(new Set());
	const [movingIds, setMovingIds] = useState<Set<number>>(new Set());

	const handleOpenModal = () => {
		setOpenModal(true);
	};

	const handleCloseModal = () => {
		setOpenModal(false);
	};

	const refetch = useCallback(
		() =>
			getCachedDesserts({
				shouldShowDisabled: true,
			}).then((newDesserts) => {
				setDesserts(newDesserts);
			}),
		[],
	);

	const handleSubmit = async (
		values: Omit<Dessert, "id" | "enabled" | "sequence">,
	) => {
		setIsLoading(true);
		try {
			const trimmedValues = {
				...values,
				name: capitalize(values.name.trim()),
				description: values.description?.trim() || null,
			};
			if (editingDessert) {
				await updateDessert(editingDessert.id, trimmedValues);
			} else {
				await createDessert({ ...trimmedValues, enabled: true });
			}

			// Refresh desserts
			await refetch();
			setEditingDessert(null);
			handleCloseModal();
			toast.success("Dessert saved successfully");
		} catch (error) {
			toast.error("Failed to save dessert");
			console.error("Failed to save dessert:", error);
		} finally {
			setIsLoading(false);
		}
	};

	const handleDelete = async () => {
		if (editingDessert) {
			try {
				setIsLoading(true);
				await deleteDessert(editingDessert.id);
				await refetch();
				setEditingDessert(null);
				handleCloseModal();
				toast.success("Dessert deleted successfully");
			} catch (error) {
				toast.error("Failed to delete dessert");
				console.error("Failed to delete dessert:", error);
			} finally {
				setIsLoading(false);
			}
		}
	};

	const handleToggleDessert = async (dessert: Dessert) => {
		const newEnabledState = !dessert.enabled;

		// Add to loading set
		setToggleLoadingIds((prev) => new Set(prev).add(dessert.id));

		// Optimistic update
		setDesserts((prev) =>
			prev.map((d) =>
				d.id === dessert.id ? { ...d, enabled: newEnabledState } : d,
			),
		);

		try {
			await toggleDessert(dessert.id, newEnabledState);
			toast.success(
				`Dessert ${newEnabledState ? "enabled" : "disabled"} successfully`,
			);
		} catch (error) {
			toast.error("Failed to toggle dessert");
			console.error("Failed to toggle dessert:", error);

			// Revert optimistic update on error
			setDesserts((prev) =>
				prev.map((d) =>
					d.id === dessert.id ? { ...d, enabled: dessert.enabled } : d,
				),
			);
		} finally {
			// Remove from loading set
			setToggleLoadingIds((prev) => {
				const newSet = new Set(prev);
				newSet.delete(dessert.id);
				return newSet;
			});

			// Refetch to ensure consistency
			await refetch();
		}
	};

	const handleToggleOutOfStock = async (dessert: Dessert) => {
		const newOutOfStockState = !dessert.isOutOfStock;

		// Add to loading set
		setStockToggleLoadingIds((prev) => new Set(prev).add(dessert.id));

		// Optimistic update
		setDesserts((prev) =>
			prev.map((d) =>
				d.id === dessert.id ? { ...d, isOutOfStock: newOutOfStockState } : d,
			),
		);

		try {
			await toggleOutOfStock(dessert.id, newOutOfStockState);
			toast.success(
				`Dessert marked as ${newOutOfStockState ? "out of stock" : "back in stock"} successfully`,
			);
		} catch (error) {
			toast.error("Failed to toggle stock status");
			console.error("Failed to toggle stock status:", error);

			// Revert optimistic update on error
			setDesserts((prev) =>
				prev.map((d) =>
					d.id === dessert.id
						? { ...d, isOutOfStock: dessert.isOutOfStock }
						: d,
				),
			);
		} finally {
			// Remove from loading set
			setStockToggleLoadingIds((prev) => {
				const newSet = new Set(prev);
				newSet.delete(dessert.id);
				return newSet;
			});

			// Refetch to ensure consistency
			await refetch();
		}
	};

	const handleDisableAll = async () => {
		try {
			setIsLoading(true);
			setDesserts(desserts.map((d) => ({ ...d, enabled: false })));
			await disableAllDesserts();
			await refetch();
			toast.success("All desserts disabled successfully");
		} catch (error) {
			toast.error("Failed to disable all desserts");
			console.error("Failed to disable all desserts:", error);
			await refetch();
		} finally {
			setIsLoading(false);
		}
	};

	// Filter desserts based on search term and separate enabled/disabled
	const filteredDesserts = desserts.filter((dessert) =>
		dessert.name.toLowerCase().includes(searchTerm.toLowerCase()),
	);

	const enabledDesserts = filteredDesserts.filter((d) => d.enabled);
	const disabledDesserts = filteredDesserts.filter((d) => !d.enabled);

	const handleMoveUp = async (dessert: Dessert) => {
		const enabledDesserts = filteredDesserts.filter((d) => d.enabled);
		const currentIndex = enabledDesserts.findIndex((d) => d.id === dessert.id);
		if (currentIndex <= 0) return; // Can't move up if already at top

		const targetDessert = enabledDesserts[currentIndex - 1];

		setMovingIds((prev) => new Set(prev).add(dessert.id));

		try {
			// Swap sequences
			await updateDessertSequence(dessert.id, targetDessert.sequence);
			await updateDessertSequence(targetDessert.id, dessert.sequence);

			// Update local state optimistically
			setDesserts((prev) =>
				prev.map((d) => {
					if (d.id === dessert.id)
						return { ...d, sequence: targetDessert.sequence };
					if (d.id === targetDessert.id)
						return { ...d, sequence: dessert.sequence };
					return d;
				}),
			);

			await refetch();
		} catch (error) {
			toast.error("Failed to move dessert up");
			console.error("Failed to move dessert up:", error);
		} finally {
			setMovingIds((prev) => {
				const newSet = new Set(prev);
				newSet.delete(dessert.id);
				return newSet;
			});
		}
	};

	const handleMoveDown = async (dessert: Dessert) => {
		const enabledDesserts = filteredDesserts.filter((d) => d.enabled);
		const currentIndex = enabledDesserts.findIndex((d) => d.id === dessert.id);
		if (currentIndex >= enabledDesserts.length - 1) return; // Can't move down if already at bottom

		const targetDessert = enabledDesserts[currentIndex + 1];

		setMovingIds((prev) => new Set(prev).add(dessert.id));

		try {
			// Swap sequences
			await updateDessertSequence(dessert.id, targetDessert.sequence);
			await updateDessertSequence(targetDessert.id, dessert.sequence);

			// Update local state optimistically
			setDesserts((prev) =>
				prev.map((d) => {
					if (d.id === dessert.id)
						return { ...d, sequence: targetDessert.sequence };
					if (d.id === targetDessert.id)
						return { ...d, sequence: dessert.sequence };
					return d;
				}),
			);

			await refetch();
		} catch (error) {
			toast.error("Failed to move dessert down");
			console.error("Failed to move dessert down:", error);
		} finally {
			setMovingIds((prev) => {
				const newSet = new Set(prev);
				newSet.delete(dessert.id);
				return newSet;
			});
		}
	};

	const handleMoveToTop = async (dessert: Dessert) => {
		if (!dessert.enabled) return;

		setMovingIds((prev) => new Set(prev).add(dessert.id));

		try {
			await moveDessertToTop(dessert.id);
			await refetch();
			toast.success("Dessert moved to top");
		} catch (error) {
			toast.error("Failed to move dessert to top");
			console.error("Failed to move dessert to top:", error);
		} finally {
			setMovingIds((prev) => {
				const newSet = new Set(prev);
				newSet.delete(dessert.id);
				return newSet;
			});
		}
	};

	const handleMoveToBottom = async (dessert: Dessert) => {
		if (!dessert.enabled) return;

		setMovingIds((prev) => new Set(prev).add(dessert.id));

		try {
			await moveDessertToBottom(dessert.id);
			await refetch();
			toast.success("Dessert moved to bottom");
		} catch (error) {
			toast.error("Failed to move dessert to bottom");
			console.error("Failed to move dessert to bottom:", error);
		} finally {
			setMovingIds((prev) => {
				const newSet = new Set(prev);
				newSet.delete(dessert.id);
				return newSet;
			});
		}
	};

	return (
		<div className="@container/desserts">
			<div className="space-y-4 @md/desserts:space-y-6 @lg/desserts:space-y-8 p-2 @sm/desserts:p-4 @md/desserts:p-0">
				<Dialog open={openModal} onOpenChange={handleCloseModal}>
					<DialogContent className="mx-2 max-w-[calc(100vw-1rem)] sm:mx-4 sm:max-w-[calc(100vw-2rem)] md:max-w-lg md:mx-0 md:-mt-28">
						<DialogHeader>
							<DialogTitle>
								{editingDessert ? "Edit Dessert" : "Add New Dessert"}
							</DialogTitle>
						</DialogHeader>
						<DessertForm
							key={editingDessert?.id}
							initialData={editingDessert ?? undefined}
							onSubmit={handleSubmit}
							onDelete={handleDelete}
							isLoading={isLoading}
						/>
					</DialogContent>
				</Dialog>

				<div className="flex flex-col space-y-3 @sm/desserts:space-y-4 @md/desserts:flex-row @md/desserts:justify-between @md/desserts:items-center @md/desserts:space-y-0">
					<h2 className="text-xl @sm/desserts:text-2xl @lg/desserts:text-3xl font-bold">
						Desserts
					</h2>
					<div className="flex flex-col space-y-2 @sm/desserts:flex-row @sm/desserts:gap-2 @sm/desserts:space-y-0 @md/desserts:gap-3">
						<Button
							type="button"
							variant="outline"
							onClick={handleDisableAll}
							disabled={isLoading || desserts.every((d) => !d.enabled)}
							className="w-full @sm/desserts:w-auto text-sm"
							size="sm"
						>
							{isLoading ? "Disabling..." : "Disable All"}
						</Button>
						<Button
							type="button"
							onClick={() => {
								setEditingDessert(null);
								handleOpenModal();
							}}
							className="w-full @sm/desserts:w-auto text-sm"
							size="sm"
						>
							Add Dessert
						</Button>
					</div>
				</div>

				<div className="flex flex-col space-y-2 @sm/desserts:flex-row @sm/desserts:gap-3 @sm/desserts:items-center @sm/desserts:space-y-0 @md/desserts:gap-4">
					<Input
						placeholder="Search desserts by name..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="w-full @sm/desserts:flex-1 @md/desserts:max-w-sm text-sm"
					/>
					{searchTerm && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => setSearchTerm("")}
							className="w-full @sm/desserts:w-auto text-xs"
						>
							Clear
						</Button>
					)}
				</div>

				{/* Enabled Desserts Section */}
				{enabledDesserts.length > 0 && (
					<div>
						<h3 className="text-lg font-semibold mb-4 text-green-700">
							Available Desserts ({enabledDesserts.length})
						</h3>
						<div className="grid grid-cols-1 @sm/desserts:grid-cols-2 @lg/desserts:grid-cols-3 @xl/desserts:grid-cols-4 gap-4 @sm/desserts:gap-6">
							{enabledDesserts.map((dessert, index) => (
								<div
									key={dessert.id}
									className="animate-in fade-in-0 slide-in-from-bottom-4 duration-300"
									style={{ animationDelay: `${index * 50}ms` }}
								>
									<DessertCard
										dessert={dessert}
										index={index}
										totalCount={enabledDesserts.length}
										onEdit={(dessert) => {
											setEditingDessert(dessert);
											handleOpenModal();
										}}
										onToggle={handleToggleDessert}
										onToggleStock={handleToggleOutOfStock}
										onMoveUp={handleMoveUp}
										onMoveDown={handleMoveDown}
										onMoveToTop={handleMoveToTop}
										onMoveToBottom={handleMoveToBottom}
										isToggleLoading={toggleLoadingIds.has(dessert.id)}
										isStockToggleLoading={stockToggleLoadingIds.has(dessert.id)}
										isMoving={movingIds.has(dessert.id)}
									/>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Disabled Desserts Section */}
				{disabledDesserts.length > 0 && (
					<div>
						<h3 className="text-lg font-semibold mb-4 text-red-700">
							Disabled Desserts ({disabledDesserts.length})
						</h3>
						<div className="grid grid-cols-1 @sm/desserts:grid-cols-2 @lg/desserts:grid-cols-3 @xl/desserts:grid-cols-4 gap-4 @sm/desserts:gap-6">
							{disabledDesserts.map((dessert, index) => (
								<div
									key={dessert.id}
									className="animate-in fade-in-0 slide-in-from-bottom-4 duration-300"
									style={{
										animationDelay: `${(enabledDesserts.length + index) * 50}ms`,
									}}
								>
									<DessertCard
										dessert={dessert}
										index={index}
										totalCount={disabledDesserts.length}
										onEdit={(dessert) => {
											setEditingDessert(dessert);
											handleOpenModal();
										}}
										onToggle={handleToggleDessert}
										onToggleStock={handleToggleOutOfStock}
										onMoveUp={handleMoveUp}
										onMoveDown={handleMoveDown}
										onMoveToTop={handleMoveToTop}
										onMoveToBottom={handleMoveToBottom}
										isToggleLoading={toggleLoadingIds.has(dessert.id)}
										isStockToggleLoading={stockToggleLoadingIds.has(dessert.id)}
										isMoving={movingIds.has(dessert.id)}
									/>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Empty state */}
				{filteredDesserts.length === 0 && (
					<div className="text-center py-12">
						<div className="text-muted-foreground mb-4">
							{searchTerm
								? "No desserts found matching your search."
								: "No desserts available."}
						</div>
						{!searchTerm && (
							<Button
								onClick={() => {
									setEditingDessert(null);
									handleOpenModal();
								}}
							>
								Add Your First Dessert
							</Button>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
