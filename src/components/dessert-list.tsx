"use client";

import { IconCake } from "@tabler/icons-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
	batchUpdateDessertSequences,
	toggleOutOfStock,
} from "@/app/desserts/actions";
import type { Dessert } from "@/lib/types";
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
	const [isEditMode, setIsEditMode] = useState(false);
	const [isPending, startTransition] = useTransition();
	const [localDesserts, setLocalDesserts] = useState(desserts);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
	const [stockToggleLoadingIds, setStockToggleLoadingIds] = useState<
		Set<number>
	>(new Set());
	const [searchQuery, setSearchQuery] = useState("");

	// Update local desserts when prop changes
	useEffect(() => {
		setLocalDesserts(desserts);
		setHasUnsavedChanges(false);
	}, [desserts]);

	const handleToggleOutOfStock = useCallback(
		async (e: React.MouseEvent, dessert: Dessert) => {
			e.stopPropagation();

			const newOutOfStockState = !dessert.isOutOfStock;
			setStockToggleLoadingIds((prev) => new Set(prev).add(dessert.id));

			// Optimistic update
			setLocalDesserts((prev) =>
				prev.map((d) =>
					d.id === dessert.id ? { ...d, isOutOfStock: newOutOfStockState } : d,
				),
			);

			try {
				await toggleOutOfStock(dessert.id, newOutOfStockState);
				toast.success(
					`Marked as ${newOutOfStockState ? "out of stock" : "back in stock"}`,
				);
			} catch (error) {
				toast.error("Failed to update stock status");
				console.error("Failed to toggle stock status:", error);

				// Revert optimistic update on error
				setLocalDesserts((prev) =>
					prev.map((d) =>
						d.id === dessert.id
							? { ...d, isOutOfStock: dessert.isOutOfStock }
							: d,
					),
				);
			} finally {
				setStockToggleLoadingIds((prev) => {
					const newSet = new Set(prev);
					newSet.delete(dessert.id);
					return newSet;
				});
			}
		},
		[],
	);

	const handleMoveToTop = (dessert: Dessert) => {
		const currentIndex = localDesserts.findIndex((d) => d.id === dessert.id);
		if (currentIndex > 0) {
			const newOrder = [...localDesserts];
			const [movedItem] = newOrder.splice(currentIndex, 1);
			newOrder.unshift(movedItem);
			setLocalDesserts(newOrder);
			setHasUnsavedChanges(true);
		}
	};

	const handleMoveToBottom = (dessert: Dessert) => {
		const currentIndex = localDesserts.findIndex((d) => d.id === dessert.id);
		if (currentIndex < localDesserts.length - 1) {
			const newOrder = [...localDesserts];
			const [movedItem] = newOrder.splice(currentIndex, 1);
			newOrder.push(movedItem);
			setLocalDesserts(newOrder);
			setHasUnsavedChanges(true);
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
			setLocalDesserts(newOrder);
			setHasUnsavedChanges(true);
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
			setLocalDesserts(newOrder);
			setHasUnsavedChanges(true);
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
		setHasUnsavedChanges(false);
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

	// Separate in-stock and out-of-stock desserts
	const inStockDesserts = filteredDesserts.filter((d) => !d.isOutOfStock);
	const outOfStockDesserts = filteredDesserts.filter((d) => d.isOutOfStock);

	return (
		<div>
			<DessertListHeader
				isEditMode={isEditMode}
				hasUnsavedChanges={hasUnsavedChanges}
				isPending={isPending}
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
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
