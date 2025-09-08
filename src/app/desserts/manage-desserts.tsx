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
	toggleDessert,
	updateDessert,
	updateDessertSequence,
} from "./actions";

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
				name: values.name.trim(),
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

	// Filter desserts based on search term
	const filteredDesserts = desserts.filter((dessert) =>
		dessert.name.toLowerCase().includes(searchTerm.toLowerCase()),
	);

	const handleMoveUp = async (dessert: Dessert) => {
		const currentIndex = filteredDesserts.findIndex((d) => d.id === dessert.id);
		if (currentIndex <= 0) return; // Can't move up if already at top

		const targetDessert = filteredDesserts[currentIndex - 1];

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
		const currentIndex = filteredDesserts.findIndex((d) => d.id === dessert.id);
		if (currentIndex >= filteredDesserts.length - 1) return; // Can't move down if already at bottom

		const targetDessert = filteredDesserts[currentIndex + 1];

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

	return (
		<div className="space-y-4 md:space-y-6 lg:space-y-8 p-2 sm:p-4 md:p-0">
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

			<div className="flex flex-col space-y-3 sm:space-y-4 md:flex-row md:justify-between md:items-center md:space-y-0">
				<h2 className="text-xl sm:text-2xl lg:text-3xl font-bold">Desserts</h2>
				<div className="flex flex-col space-y-2 sm:flex-row sm:gap-2 sm:space-y-0 md:gap-3">
					<Button
						type="button"
						variant="outline"
						onClick={handleDisableAll}
						disabled={isLoading || desserts.every((d) => !d.enabled)}
						className="w-full sm:w-auto text-sm"
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
						className="w-full sm:w-auto text-sm"
						size="sm"
					>
						Add Dessert
					</Button>
				</div>
			</div>

			<div className="flex flex-col space-y-2 sm:flex-row sm:gap-3 sm:items-center sm:space-y-0 md:gap-4">
				<Input
					placeholder="Search desserts by name..."
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
					className="w-full sm:flex-1 md:max-w-sm text-sm"
				/>
				{searchTerm && (
					<Button
						variant="outline"
						size="sm"
						onClick={() => setSearchTerm("")}
						className="w-full sm:w-auto text-xs"
					>
						Clear
					</Button>
				)}
			</div>

			{/* Dessert Cards Grid */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
				{filteredDesserts.map((dessert, index) => (
					<div
						key={dessert.id}
						className="animate-in fade-in-0 slide-in-from-bottom-4 duration-300"
						style={{ animationDelay: `${index * 50}ms` }}
					>
						<DessertCard
							dessert={dessert}
							index={index}
							totalCount={filteredDesserts.length}
							onEdit={(dessert) => {
								setEditingDessert(dessert);
								handleOpenModal();
							}}
							onToggle={handleToggleDessert}
							onMoveUp={handleMoveUp}
							onMoveDown={handleMoveDown}
							isToggleLoading={toggleLoadingIds.has(dessert.id)}
							isMoving={movingIds.has(dessert.id)}
						/>
					</div>
				))}
			</div>

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
	);
}
