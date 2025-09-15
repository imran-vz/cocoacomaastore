"use client";

import { Edit3, Save, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { batchUpdateDessertSequences } from "@/app/desserts/actions";
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

	// Update local desserts when prop changes
	useEffect(() => {
		setLocalDesserts(desserts);
		setHasUnsavedChanges(false);
	}, [desserts]);

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
					{localDesserts.map((dessert) => (
						<Button
							asChild
							key={dessert.id}
							variant={"outline"}
							onClick={() => addToCart(dessert)}
							className="py-2 h-auto items-start hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
						>
							<Card className="w-full shadow-none py-3 gap-2 cursor-pointer">
								<CardContent className="px-3 py-0 w-full">
									<div className="flex flex-col items-start text-left">
										<h4 className="font-medium text-sm text-primary capitalize line-clamp-2 mb-1 max-w-[90%] truncate">
											{dessert.name}
										</h4>
										{dessert.description && (
											<p className="text-xs text-muted-foreground line-clamp-2 mb-2">
												{dessert.description}
											</p>
										)}
										<p className="text-sm font-semibold text-green-700">
											₹{dessert.price.toFixed(2)}
										</p>
									</div>
								</CardContent>
							</Card>
						</Button>
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
