"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Dessert } from "@/lib/types";

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
	return (
		<motion.div
			key={dessert.id}
			className="relative flex flex-col gap-2"
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -20 }}
			transition={{ duration: 0.3 }}
			layout
		>
			<motion.div
				whileTap={{ scale: 0.95 }}
				transition={{ type: "spring", stiffness: 400, damping: 17 }}
			>
				<Button
					asChild
					variant={"outline"}
					onClick={() => !dessert.isOutOfStock && onAddToCart(dessert)}
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

				{/* Stock toggle button */}
				<Button
					size="sm"
					variant={dessert.isOutOfStock ? "secondary" : "outline"}
					onClick={(e) => onToggleStock(e, dessert)}
					disabled={isStockToggleLoading}
					className={`w-full text-xs h-8 ${
						dessert.isOutOfStock
							? "bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200"
							: "border-gray-200"
					}`}
				>
					{isStockToggleLoading ? (
						<span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
					) : dessert.isOutOfStock ? (
						"Back In Stock"
					) : (
						"Mark Out of Stock"
					)}
				</Button>
			</motion.div>
		</motion.div>
	);
}
