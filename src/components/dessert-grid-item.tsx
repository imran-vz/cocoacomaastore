"use client";

import { motion, useAnimation } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Dessert } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DessertGridItemProps {
	dessert: Dessert;
	onAddToCart: (dessert: Dessert) => void;
	onToggleStock: (e: React.MouseEvent, dessert: Dessert) => void;
	isStockToggleLoading: boolean;
}

export function DessertGridItem({
	dessert,
	onAddToCart,
	onToggleStock,
	isStockToggleLoading,
}: DessertGridItemProps) {
	const inventoryQty = dessert.inventoryQuantity;
	const isInventoryOutOfStock =
		!dessert.hasUnlimitedStock &&
		inventoryQty !== undefined &&
		inventoryQty <= 0;
	const isUnavailable = dessert.isOutOfStock || isInventoryOutOfStock;
	const overlayControls = useAnimation();

	const handleClick = async () => {
		if (!isUnavailable) {
			// Add to cart immediately
			onAddToCart(dessert);

			// Cancel any ongoing animation and start fresh
			overlayControls.stop();
			overlayControls.set({ x: "100%" });

			// Run animation independently (fire and forget)
			overlayControls
				.start({
					x: ["100%", "0%"],
					transition: { duration: 0.3, ease: "easeInOut" },
				})
				.then(() =>
					overlayControls.start({
						x: "-100%",
						transition: { duration: 0.3, ease: "easeInOut" },
					}),
				)
				.then(() => overlayControls.set({ x: "100%" }));
		}
	};

	return (
		<motion.div
			key={dessert.id}
			className="relative h-full select-none"
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.95 }}
			transition={{ duration: 0.2 }}
			layout
		>
			<Card className="h-full flex flex-col p-0 gap-0 overflow-hidden border-2 hover:border-primary/20 transition-colors">
				<div className="relative flex-1 flex flex-col">
					{/* Clickable Area for Add to Cart */}
					<button
						type="button"
						onClick={handleClick}
						disabled={isUnavailable}
						className={cn(
							"flex-1 flex flex-col text-left p-4 gap-2 transition-colors hover:bg-muted/50 active:bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
							isUnavailable &&
								"cursor-not-allowed opacity-60 hover:bg-transparent",
						)}
					>
						{/* Green slide overlay */}
						<motion.div
							className="absolute inset-0 bg-green-500/20 pointer-events-none z-0"
							initial={{ x: "100%" }}
							animate={overlayControls}
						/>

						<div className="relative z-10 w-full">
							<div className="flex justify-between items-start gap-2 mb-1">
								<h4
									className={cn(
										"font-semibold text-base leading-tight line-clamp-2",
										isUnavailable && "line-through text-muted-foreground",
									)}
								>
									{dessert.name}
								</h4>
								<span
									className={cn(
										"shrink-0 font-bold text-base",
										isUnavailable ? "text-muted-foreground" : "text-primary",
									)}
								>
									₹{dessert.price}
								</span>
							</div>

							{dessert.description && (
								<p className="text-sm text-muted-foreground line-clamp-2 mb-3 leading-snug">
									{dessert.description}
								</p>
							)}

							<div className="mt-auto flex items-center gap-2">
								{isUnavailable ? (
									<span className="inline-flex items-center px-2 py-1 rounded-md bg-destructive/10 text-destructive text-xs font-medium">
										Out of Stock
									</span>
								) : inventoryQty !== undefined ? (
									<span
										className={cn(
											"inline-flex items-center px-2 py-1 rounded-md text-xs font-medium",
											inventoryQty < 5
												? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
												: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
										)}
									>
										{inventoryQty} left
									</span>
								) : (
									<span className="inline-flex items-center px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-medium">
										Unlimited
									</span>
								)}
							</div>
						</div>
					</button>
				</div>

				{/* Stock Toggle Footer */}
				<div className="border-t bg-muted/30 p-1">
					<Button
						variant="ghost"
						size="sm"
						onClick={(e) => onToggleStock(e, dessert)}
						disabled={isStockToggleLoading}
						className={cn(
							"w-full h-8 text-xs font-medium hover:bg-white dark:hover:bg-zinc-800 transition-colors",
							dessert.isOutOfStock
								? "text-destructive hover:text-destructive"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{isStockToggleLoading ? (
							<span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent mr-2" />
						) : null}
						{dessert.isOutOfStock ? "Set as Available" : "Mark as Unavailable"}
					</Button>
				</div>
			</Card>
		</motion.div>
	);
}
