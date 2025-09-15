"use client";

import { Edit3, Save } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
	moveDessertToBottom,
	moveDessertToTop,
	updateDessertSequence,
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
	const [, startTransition] = useTransition();
	const [movingDessertId, setMovingDessertId] = useState<number | null>(null);

	const handleMoveToTop = (dessert: Dessert) => {
		setMovingDessertId(dessert.id);
		startTransition(async () => {
			try {
				await moveDessertToTop(dessert.id);
			} catch (error) {
				console.error(error);
				toast.error("Failed to move dessert to top");
			} finally {
				setMovingDessertId(null);
			}
		});
	};

	const handleMoveToBottom = (dessert: Dessert) => {
		setMovingDessertId(dessert.id);
		startTransition(async () => {
			try {
				await moveDessertToBottom(dessert.id);
			} catch (error) {
				console.error(error);
				toast.error("Failed to move dessert to bottom");
			} finally {
				setMovingDessertId(null);
			}
		});
	};

	const handleMoveUp = (dessert: Dessert) => {
		const currentIndex = desserts.findIndex((d) => d.id === dessert.id);
		if (currentIndex > 0) {
			const prevDessert = desserts[currentIndex - 1];
			const newScore = prevDessert.sequence - 1;

			setMovingDessertId(dessert.id);
			startTransition(async () => {
				try {
					await updateDessertSequence(dessert.id, newScore);
				} catch (error) {
					console.error(error);
					toast.error("Failed to move dessert up");
				} finally {
					setMovingDessertId(null);
				}
			});
		}
	};

	const handleMoveDown = (dessert: Dessert) => {
		const currentIndex = desserts.findIndex((d) => d.id === dessert.id);
		if (currentIndex < desserts.length - 1) {
			const nextDessert = desserts[currentIndex + 1];
			const newScore = nextDessert.sequence + 1;

			setMovingDessertId(dessert.id);
			startTransition(async () => {
				try {
					await updateDessertSequence(dessert.id, newScore);
				} catch (error) {
					console.error(error);
					toast.error("Failed to move dessert down");
				} finally {
					setMovingDessertId(null);
				}
			});
		}
	};

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-2xl font-bold">Our Desserts</h2>
				<Button
					onClick={() => setIsEditMode(!isEditMode)}
					variant={isEditMode ? "default" : "outline"}
					size="sm"
					className="flex items-center gap-2"
				>
					{isEditMode ? (
						<>
							<Save className="h-4 w-4" />
							Done
						</>
					) : (
						<>
							<Edit3 className="h-4 w-4" />
							Edit Order
						</>
					)}
				</Button>
			</div>
			{isEditMode ? (
				<div className="space-y-4">
					{desserts.map((dessert, index) => (
						<DessertCard
							key={dessert.id}
							dessert={dessert}
							index={index}
							totalCount={desserts.length}
							onMoveUp={handleMoveUp}
							onMoveDown={handleMoveDown}
							onMoveToTop={handleMoveToTop}
							onMoveToBottom={handleMoveToBottom}
							isMoving={movingDessertId === dessert.id}
							showEditControls={false}
						/>
					))}
				</div>
			) : (
				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
					{desserts.map((dessert) => (
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
			{desserts.length === 0 && (
				<div className="text-center py-12">
					<div className="text-muted-foreground">
						No desserts available at the moment.
					</div>
				</div>
			)}
		</div>
	);
}
