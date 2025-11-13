"use client";

import { AnimatePresence } from "framer-motion";
import type { Dessert } from "@/lib/types";
import { DessertGridItem } from "./dessert-grid-item";

interface DessertGridProps {
	desserts: Dessert[];
	onAddToCart: (dessert: Dessert) => void;
	onToggleStock: (e: React.MouseEvent, dessert: Dessert) => void;
	stockToggleLoadingIds: Set<number>;
}

export function DessertGrid({
	desserts,
	onAddToCart,
	onToggleStock,
	stockToggleLoadingIds,
}: DessertGridProps) {
	return (
		<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
			<AnimatePresence mode="popLayout">
				{desserts.map((dessert) => (
					<DessertGridItem
						key={dessert.id}
						dessert={dessert}
						onAddToCart={onAddToCart}
						onToggleStock={onToggleStock}
						isStockToggleLoading={stockToggleLoadingIds.has(dessert.id)}
					/>
				))}
			</AnimatePresence>
		</div>
	);
}
