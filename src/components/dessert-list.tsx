"use client";

import { Edit3, Save, X } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
	batchUpdateDessertSequences,
	toggleOutOfStock,
} from "@/app/desserts/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Dessert } from "@/lib/types";
import { DessertCard } from "./dessert-card";

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

	// Sort desserts: available first, out of stock at the bottom
	const sortedDesserts = [...localDesserts].sort((a, b) => {
		if (a.isOutOfStock === b.isOutOfStock) return 0;
		return a.isOutOfStock ? 1 : -1;
	});

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-2xl font-bold">Our Desserts</h2>
				<div className="flex items-center gap-2">
					{isEditMode ? (
						<>
							{hasUnsavedChanges && (
								<Button
									onClick={handleCancelChanges}
									variant="outline"
									size="sm"
									className="flex items-center gap-2"
									disabled={isPending}
								>
									<X className="h-4 w-4" />
									Cancel
								</Button>
							)}
							<Button
								onClick={handleSaveChanges}
								variant="default"
								size="sm"
								className="flex items-center gap-2"
								disabled={isPending}
							>
								<Save className="h-4 w-4" />
								{isPending ? "Saving..." : "Done"}
							</Button>
						</>
					) : (
						<Button
							onClick={handleToggleEditMode}
							variant="outline"
							size="sm"
							className="flex items-center gap-2"
						>
							<Edit3 className="h-4 w-4" />
							Edit Order
						</Button>
					)}
				</div>
			</div>
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
				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
					{sortedDesserts.map((dessert) => (
						<div key={dessert.id} className="relative flex flex-col gap-2">
							<Button
								asChild
								variant={"outline"}
								onClick={() => !dessert.isOutOfStock && addToCart(dessert)}
								disabled={dessert.isOutOfStock}
								className="py-2 h-auto items-start hover:shadow-md transition-all duration-200 hover:scale-[1.02] disabled:hover:scale-100 w-full flex-1"
							>
								<Card className="w-full shadow-none py-2 px-3 gap-2 cursor-pointer">
									<CardContent className="px-0 w-full">
										<div className="flex flex-col items-start text-left">
											<h4
												className={`font-medium text-sm text-primary capitalize line-clamp-2 mb-1 max-w-[90%] truncate ${dessert.isOutOfStock ? "line-through text-muted-foreground" : ""}`}
											>
												{dessert.name}
											</h4>
											{dessert.description && (
												<p className="text-xs text-muted-foreground line-clamp-2 mb-2">
													{dessert.description}
												</p>
											)}
											<div className="flex items-center gap-2 w-full">
												<p
													className={`text-sm font-semibold ${dessert.isOutOfStock ? "text-muted-foreground" : "text-green-700"}`}
												>
													₹{dessert.price.toFixed(2)}
												</p>
												{dessert.isOutOfStock && (
													<span className="text-xs font-medium px-2 py-1 rounded-full bg-orange-100 text-orange-700 whitespace-nowrap">
														Out of Stock
													</span>
												)}
											</div>
										</div>
									</CardContent>
								</Card>
							</Button>

							{/* Stock toggle button - always visible */}
							<Button
								size="sm"
								variant={dessert.isOutOfStock ? "secondary" : "outline"}
								onClick={(e) => handleToggleOutOfStock(e, dessert)}
								disabled={stockToggleLoadingIds.has(dessert.id)}
								className={`w-full text-xs h-8 ${
									dessert.isOutOfStock
										? "bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200"
										: "border-gray-200"
								}`}
							>
								{stockToggleLoadingIds.has(dessert.id) ? (
									<span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
								) : dessert.isOutOfStock ? (
									"Back In Stock"
								) : (
									"Mark Out of Stock"
								)}
							</Button>
						</div>
					))}
				</div>
			)}
			{localDesserts.length === 0 && (
				<div className="text-center py-12">
					<div className="text-muted-foreground">
						No desserts available at the moment.
					</div>
				</div>
			)}
		</div>
	);
}
