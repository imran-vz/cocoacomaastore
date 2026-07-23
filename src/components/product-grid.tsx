"use client";

import { IconCake } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { tweenFast } from "@/lib/motion";
import type { ComboWithDetails, Dessert } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ComboCard, ProductCard } from "./product-card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";

interface ProductGridProps {
	desserts: Dessert[];
	combos?: ComboWithDetails[];
	onAddToCart: (dessert: Dessert) => boolean;
	onAddComboToCart?: (combo: ComboWithDetails) => boolean;
	onToggleStock?: (dessert: Dessert) => Promise<string>;
	onToggleStockComplete?: (dessertId: number) => void;
	stockToggleLoadingIds?: Set<number>;
	pinnedStockState?: Map<number, boolean>;
	searchQuery?: string;
}

export function ProductGrid({
	desserts,
	combos = [],
	onAddToCart,
	onAddComboToCart,
	onToggleStock,
	onToggleStockComplete,
	stockToggleLoadingIds = new Set(),
	pinnedStockState = new Map(),
	searchQuery = "",
}: ProductGridProps) {
	// Helper to check if dessert is unavailable
	const isUnavailable = (dessert: Dessert) =>
		(pinnedStockState.get(dessert.id) ?? dessert.isOutOfStock) ||
		(!dessert.hasUnlimitedStock && (dessert.inventoryQuantity === undefined || dessert.inventoryQuantity <= 0));

	// Filter desserts based on search
	const filteredDesserts = desserts.filter((dessert) => dessert.name.toLowerCase().includes(searchQuery.toLowerCase()));

	// Separate available and unavailable desserts
	const availableDesserts = filteredDesserts.filter((d) => !isUnavailable(d));
	const unavailableDesserts = filteredDesserts.filter((d) => isUnavailable(d));

	// Filter combos based on search
	const filteredCombos = combos.filter(
		(combo) =>
			combo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			combo.baseDessert.name.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	// Empty state
	if (filteredDesserts.length === 0 && filteredCombos.length === 0) {
		return (
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				className="flex flex-col items-center justify-center py-10 px-4 text-center"
			>
				<div className="size-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
					<IconCake className="size-8 text-muted-foreground/50" />
				</div>
				<h3 className="text-lg font-semibold text-foreground mb-1">No items found</h3>
				<p className="text-sm text-muted-foreground max-w-xs">
					{searchQuery
						? `No items match "${searchQuery}". Try a different search.`
						: "No items available at the moment."}
				</p>
			</motion.div>
		);
	}

	// Column counts follow the product pane width (sidebar + fixed cart shrink it),
	// not the viewport. Products stay 2-up on mobile; combos stay full-width until roomy.
	// @4xl ≈ 56rem / 896px container width.
	const productGridClass = "grid grid-cols-2 @4xl/products:grid-cols-3 gap-2 @sm/products:gap-3";
	const comboGridClass =
		"grid grid-cols-1 @xl/products:grid-cols-2 @4xl/products:grid-cols-3 gap-2 @sm/products:gap-3";
	// motion wrappers create stacking contexts — lift the hovered cell so the
	// hanging stock tab paints above the row beneath it.
	const itemCellClass = "relative z-0 hover:z-30 focus-within:z-30 has-[[data-stock-busy]]:z-30";

	return (
		<div className="@container/products space-y-4 @md/products:space-y-6">
			{/* Combos Section */}
			{filteredCombos.length > 0 && onAddComboToCart && (
				<section>
					<h2 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2 px-1">🎁 Combos</h2>
					<div className={comboGridClass}>
						<AnimatePresence mode="popLayout">
							{filteredCombos.map((combo) => (
								<motion.div
									key={combo.id}
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0, scale: 0.95, pointerEvents: "none" }}
									transition={tweenFast}
								>
									<ComboCard combo={combo} onAddToCart={() => onAddComboToCart(combo)} compact />
								</motion.div>
							))}
						</AnimatePresence>
					</div>
				</section>
			)}

			{/* Available Products Section */}
			{availableDesserts.length > 0 && (
				<section>
					{filteredCombos.length > 0 && (
						<h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
							All Items
						</h2>
					)}
					<div className={productGridClass}>
						<AnimatePresence mode="popLayout">
							{availableDesserts.map((dessert) => (
								<motion.div
									key={dessert.id}
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0, scale: 0.95 }}
									transition={tweenFast}
									className={itemCellClass}
								>
									<ProductCard
										dessert={dessert}
										onAddToCart={onAddToCart}
										onToggleStock={onToggleStock}
										onToggleStockComplete={onToggleStockComplete}
										isStockToggleLoading={stockToggleLoadingIds.has(dessert.id)}
										stockToggleIsOutOfStock={pinnedStockState.get(dessert.id) ?? dessert.isOutOfStock}
										compact
									/>
								</motion.div>
							))}
						</AnimatePresence>
					</div>
				</section>
			)}

			{/* Out of Stock Section */}
			{unavailableDesserts.length > 0 && (
				<section className="border-t pt-4">
					<Accordion>
						<AccordionItem value="out-of-stock" className="border-none">
							<AccordionTrigger className="py-2 hover:no-underline">
								<div className="flex items-center gap-2">
									<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
										Out of Stock
									</span>
									<span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
										{unavailableDesserts.length}
									</span>
								</div>
							</AccordionTrigger>
							<AccordionContent>
								<div className={cn(productGridClass, "pt-2 pb-7")}>
									<AnimatePresence mode="popLayout">
										{unavailableDesserts.map((dessert) => (
											<motion.div key={dessert.id} className={itemCellClass}>
												<ProductCard
													dessert={dessert}
													onAddToCart={onAddToCart}
													onToggleStock={onToggleStock}
													onToggleStockComplete={onToggleStockComplete}
													isStockToggleLoading={stockToggleLoadingIds.has(dessert.id)}
													stockToggleIsOutOfStock={pinnedStockState.get(dessert.id) ?? dessert.isOutOfStock}
													compact
												/>
											</motion.div>
										))}
									</AnimatePresence>
								</div>
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				</section>
			)}
		</div>
	);
}
