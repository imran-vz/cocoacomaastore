"use client";

import { AnimatePresence } from "framer-motion";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import type { Dessert } from "@/lib/types";
import { DessertGridItem } from "./dessert-grid-item";

interface OutOfStockSectionProps {
	desserts: Dessert[];
	onAddToCart: (dessert: Dessert) => void;
	onToggleStock: (e: React.MouseEvent, dessert: Dessert) => void;
	stockToggleLoadingIds: Set<number>;
}

export function OutOfStockSection({
	desserts,
	onAddToCart,
	onToggleStock,
	stockToggleLoadingIds,
}: OutOfStockSectionProps) {
	if (desserts.length === 0) return null;

	return (
		<Accordion type="single" collapsible>
			<AccordionItem value="out-of-stock">
				<AccordionTrigger>
					<div className="space-x-2">
						<span className="text-sm font-semibold">Out of Stock</span>
						<span className="text-xs text-muted-foreground">
							({desserts.length} {desserts.length === 1 ? "item" : "items"})
						</span>
					</div>
				</AccordionTrigger>
				<AccordionContent>
					<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 pt-4">
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
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}
