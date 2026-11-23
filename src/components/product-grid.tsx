"use client";

import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useState } from "react";
import { tweenFast } from "@/lib/motion";
import type { ComboWithDetails, Dessert } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ComboCard, ProductCard } from "./product-card";
import { EmptyState } from "./ui/empty-state";

interface ProductGridProps {
	desserts: Dessert[];
	combos?: ComboWithDetails[];
	/** In-cart quantity per dessert id (plain dessert lines only). */
	dessertQuantities?: ReadonlyMap<number, number>;
	/** In-cart quantity per combo id. */
	comboQuantities?: ReadonlyMap<number, number>;
	onAddToCart: (dessert: Dessert) => boolean;
	onAddComboToCart?: (combo: ComboWithDetails) => boolean;
	onToggleStock?: (dessert: Dessert) => Promise<string>;
	onToggleStockComplete?: (dessertId: number) => void;
	stockToggleLoadingIds?: Set<number>;
	pinnedStockState?: Map<number, boolean>;
	searchQuery?: string;
}

const EMPTY_QUANTITIES: ReadonlyMap<number, number> = new Map();

/**
 * Tiles are at least 150px wide: two columns on every phone from 360px up, a single
 * column below that, and more columns as the product pane (not the viewport) grows.
 * From a 768px pane the minimum rises so wide desktops don't turn into a wall of tiles.
 */
const tileGridClass =
	"grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 @md/products:gap-3 @3xl/products:grid-cols-[repeat(auto-fill,minmax(176px,1fr))]";

export const ProductGrid = memo(function ProductGrid({
	desserts,
	combos = [],
	dessertQuantities = EMPTY_QUANTITIES,
	comboQuantities = EMPTY_QUANTITIES,
	onAddToCart,
	onAddComboToCart,
	onToggleStock,
	onToggleStockComplete,
	stockToggleLoadingIds = new Set(),
	pinnedStockState = new Map(),
	searchQuery = "",
}: ProductGridProps) {
	const [showOutOfStock, setShowOutOfStock] = useState(false);

	const isUnavailable = (dessert: Dessert) =>
		(pinnedStockState.get(dessert.id) ?? dessert.isOutOfStock) ||
		(!dessert.hasUnlimitedStock && (dessert.inventoryQuantity === undefined || dessert.inventoryQuantity <= 0));

	const query = searchQuery.toLowerCase();
	const filteredDesserts = desserts.filter((dessert) => dessert.name.toLowerCase().includes(query));
	const availableDesserts = filteredDesserts.filter((d) => !isUnavailable(d));
	const unavailableDesserts = filteredDesserts.filter((d) => isUnavailable(d));

	const filteredCombos = onAddComboToCart
		? combos.filter(
				(combo) => combo.name.toLowerCase().includes(query) || combo.baseDessert.name.toLowerCase().includes(query),
			)
		: [];

	if (filteredDesserts.length === 0 && filteredCombos.length === 0) {
		return (
			<EmptyState
				variant="block"
				title="No items found"
				description={searchQuery ? `Nothing matches "${searchQuery}".` : "Nothing is on sale right now."}
			/>
		);
	}

	return (
		<div className="@container/products space-y-6">
			{(filteredCombos.length > 0 || availableDesserts.length > 0) && (
				<section aria-label="Menu">
					<div className={tileGridClass}>
						<AnimatePresence mode="popLayout">
							{filteredCombos.map((combo) => (
								<motion.div
									key={`combo-${combo.id}`}
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0, scale: 0.97, pointerEvents: "none" }}
									transition={tweenFast}
								>
									<ComboCard
										combo={combo}
										cartQuantity={comboQuantities.get(combo.id) ?? 0}
										onAddToCart={() => onAddComboToCart?.(combo) ?? false}
									/>
								</motion.div>
							))}
							{availableDesserts.map((dessert) => (
								<motion.div
									key={`dessert-${dessert.id}`}
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={tweenFast}
								>
									<ProductCard
										dessert={dessert}
										cartQuantity={dessertQuantities.get(dessert.id) ?? 0}
										onAddToCart={onAddToCart}
										onToggleStock={onToggleStock}
										onToggleStockComplete={onToggleStockComplete}
										isStockToggleLoading={stockToggleLoadingIds.has(dessert.id)}
										stockToggleIsOutOfStock={pinnedStockState.get(dessert.id) ?? dessert.isOutOfStock}
									/>
								</motion.div>
							))}
						</AnimatePresence>
					</div>
				</section>
			)}

			{unavailableDesserts.length > 0 && (
				<section>
					<h2>
						<button
							type="button"
							aria-expanded={showOutOfStock}
							aria-controls="pos-out-of-stock"
							onClick={() => setShowOutOfStock((current) => !current)}
							className="-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 text-left text-[15px] leading-5 font-semibold text-foreground hover:bg-accent focus-ring"
						>
							<span>
								Out of stock
								<span className="ml-1.5 font-normal text-muted-foreground tabular-nums">
									{unavailableDesserts.length}
								</span>
							</span>
							<ChevronDown
								aria-hidden="true"
								className={cn(
									"size-5 text-muted-foreground transition-transform duration-200",
									showOutOfStock && "rotate-180",
								)}
							/>
						</button>
					</h2>
					{showOutOfStock && (
						<div id="pos-out-of-stock" className={cn(tileGridClass, "mt-2")}>
							{unavailableDesserts.map((dessert) => (
								<ProductCard
									key={dessert.id}
									dessert={dessert}
									onAddToCart={onAddToCart}
									onToggleStock={onToggleStock}
									onToggleStockComplete={onToggleStockComplete}
									isStockToggleLoading={stockToggleLoadingIds.has(dessert.id)}
									stockToggleIsOutOfStock={pinnedStockState.get(dessert.id) ?? dessert.isOutOfStock}
								/>
							))}
						</div>
					)}
				</section>
			)}
		</div>
	);
});
