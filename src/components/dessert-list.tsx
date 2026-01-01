"use client";

import { IconCake } from "@tabler/icons-react";
import { useCallback, useEffect, useTransition } from "react";
import { toast } from "sonner";
import {
	batchUpdateDessertSequences,
	toggleOutOfStock,
} from "@/app/desserts/actions";
import type { Dessert } from "@/lib/types";
import { useDessertStore } from "@/store/dessert-store";
import { DessertCard } from "./dessert-card";
import { DessertGrid } from "./dessert-grid";
import { DessertListHeader } from "./dessert-list-header";
import { OutOfStockSection } from "./out-of-stock-section";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "./ui/empty";

interface DessertListProps {
	desserts: Dessert[];
	addToCart: (dessert: Dessert) => void;
}

export function DessertList({ desserts, addToCart }: DessertListProps) {
	const {
		searchQuery,
		isEditMode,
		setIsEditMode,
		localDesserts,
		hasUnsavedChanges,
		stockToggleLoadingIds,
		setLocalDesserts,
		setHasUnsavedChanges,
		updateDessert,
		reorderDesserts,
		addStockToggleLoadingId,
		removeStockToggleLoadingId,
	} = useDessertStore();
	const [isPending, startTransition] = useTransition();

	// Update local desserts when prop changes
	useEffect(() => {
		setLocalDesserts(desserts);
	}, [desserts, setLocalDesserts]);

	const handleToggleOutOfStock = useCallback(
		async (e: React.MouseEvent, dessert: Dessert) => {
			e.stopPropagation();

			const newOutOfStockState = !dessert.isOutOfStock;
			addStockToggleLoadingId(dessert.id);

			// Optimistic update
			updateDessert(dessert.id, { isOutOfStock: newOutOfStockState });

			try {
				await toggleOutOfStock(dessert.id, newOutOfStockState);
				toast.success(
					`Marked as ${newOutOfStockState ? "out of stock" : "back in stock"}`,
				);
			} catch (error) {
				toast.error("Failed to update stock status");
				console.error("Failed to toggle stock status:", error);

				// Revert optimistic update on error
				updateDessert(dessert.id, { isOutOfStock: dessert.isOutOfStock });
			} finally {
				removeStockToggleLoadingId(dessert.id);
			}
		},
		[addStockToggleLoadingId, updateDessert, removeStockToggleLoadingId],
	);

	const handleMoveToTop = (dessert: Dessert) => {
		const currentIndex = localDesserts.findIndex((d) => d.id === dessert.id);
		if (currentIndex > 0) {
			const newOrder = [...localDesserts];
			const [movedItem] = newOrder.splice(currentIndex, 1);
			newOrder.unshift(movedItem);
			reorderDesserts(newOrder);
		}
	};

	const handleMoveToBottom = (dessert: Dessert) => {
		const currentIndex = localDesserts.findIndex((d) => d.id === dessert.id);
		if (currentIndex < localDesserts.length - 1) {
			const newOrder = [...localDesserts];
			const [movedItem] = newOrder.splice(currentIndex, 1);
			newOrder.push(movedItem);
			reorderDesserts(newOrder);
		}
	};

	const handleMoveUp = (dessert: Dessert) => {
		const currentIndex = localDesserts.findIndex((d) => d.id === dessert.id);
		if (currentIndex > 0) {
			const newOrder = [...localDesserts];
			[newOrder[currentIndex], newOrder[currentIndex - 1]] = [
				newOrder[currentIndex - 1],
				newOrder[currentIndex],
			];
			reorderDesserts(newOrder);
		}
	};

	const handleMoveDown = (dessert: Dessert) => {
		const currentIndex = localDesserts.findIndex((d) => d.id === dessert.id);
		if (currentIndex < localDesserts.length - 1) {
			const newOrder = [...localDesserts];
			[newOrder[currentIndex], newOrder[currentIndex + 1]] = [
				newOrder[currentIndex + 1],
				newOrder[currentIndex],
			];
			reorderDesserts(newOrder);
		}
	};

	const handleSaveChanges = async () => {
		if (!hasUnsavedChanges) {
			setIsEditMode(false);
			return;
		}

		startTransition(async () => {
			try {
				// Collect all sequence updates that need to be made
				const updates: Array<{ id: number; newScore: number }> = [];

				for (let i = 0; i < localDesserts.length; i++) {
					const dessert = localDesserts[i];
					const originalDessert = desserts.find((d) => d.id === dessert.id);
					if (originalDessert && originalDessert.sequence !== i) {
						updates.push({ id: dessert.id, newScore: i });
					}
				}

				// Only call the batch update if there are changes
				if (updates.length > 0) {
					await batchUpdateDessertSequences(updates);
				}

				setHasUnsavedChanges(false);
				setIsEditMode(false);
				toast.success("Dessert order saved successfully");
			} catch (error) {
				console.error(error);
				toast.error("Failed to save dessert order");
			}
		});
	};

	const handleCancelChanges = () => {
		setLocalDesserts(desserts);
		setIsEditMode(false);
	};

	const handleToggleEditMode = () => {
		if (isEditMode && hasUnsavedChanges) {
			// Show confirmation or just save automatically
			handleSaveChanges();
		} else {
			setIsEditMode(!isEditMode);
		}
	};

	// Filter desserts based on search query
	const filteredDesserts = localDesserts.filter((dessert) =>
		dessert.name.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	const isUnavailable = (dessert: Dessert) =>
		dessert.isOutOfStock ||
		(!dessert.hasUnlimitedStock &&
			dessert.inventoryQuantity !== undefined &&
			dessert.inventoryQuantity <= 0);

	// Separate in-stock and out-of-stock desserts
	const inStockDesserts = filteredDesserts.filter((d) => !isUnavailable(d));
	const outOfStockDesserts = filteredDesserts.filter((d) => isUnavailable(d));

	return (
		<div>
			<DessertListHeader
				hasUnsavedChanges={hasUnsavedChanges}
				isPending={isPending}
				onToggleEditMode={handleToggleEditMode}
				onSaveChanges={handleSaveChanges}
				onCancelChanges={handleCancelChanges}
			/>

			{isEditMode ? (
				<div className="space-y-4">
					{localDesserts.map((dessert, index) => (
						<DessertCard
							key={dessert.id}
							dessert={dessert}
							index={index}
							totalCount={localDesserts.length}
							onMoveUp={handleMoveUp}
							onMoveDown={handleMoveDown}
							onMoveToTop={handleMoveToTop}
							onMoveToBottom={handleMoveToBottom}
							showEditControls={false}
						/>
					))}
				</div>
			) : (
				<>
					{/* In-stock desserts */}
					<DessertGrid
						desserts={inStockDesserts}
						onAddToCart={addToCart}
						onToggleStock={handleToggleOutOfStock}
						stockToggleLoadingIds={stockToggleLoadingIds}
					/>

					<div className="mt-6 border-b border-t">
						{/* Out-of-stock desserts in accordion */}
						<OutOfStockSection
							desserts={outOfStockDesserts}
							onAddToCart={addToCart}
							onToggleStock={handleToggleOutOfStock}
							stockToggleLoadingIds={stockToggleLoadingIds}
						/>
					</div>
				</>
			)}
			{filteredDesserts.length === 0 && (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<IconCake />
						</EmptyMedia>
						<EmptyTitle>No Desserts Found</EmptyTitle>
						<EmptyDescription>
							{searchQuery
								? "No desserts match your search. Try a different search term."
								: "No desserts available at the moment."}
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}
		</div>
	);
}
