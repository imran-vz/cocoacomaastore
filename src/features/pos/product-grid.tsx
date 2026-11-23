"use client";

import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import type { ComboWithDetails, Dessert } from "@/features/catalog/queries";
import { isDessertOnSale } from "@/features/catalog/rules";
import { isInStock, type StockCounts, type TileKey } from "@/features/pos/cart";
import { TILE_GRID_CLASS } from "@/features/pos/layout";
import { ComboTile, DessertTile, UnavailableDessertTile } from "@/features/pos/product-tiles";
import type { PosCart } from "@/features/pos/use-pos-cart";
import { tweenFast } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Tiles fade in and out as search and stock change what the grid shows, and the others slide into place. */
const TILE_MOTION = {
	layout: true,
	initial: { opacity: 0 },
	animate: { opacity: 1 },
	exit: { opacity: 0, scale: 0.97, pointerEvents: "none" },
	transition: tweenFast,
} as const;

/** The Sell grid: combos and desserts on sale, then a collapsed list of desserts that cannot be sold now. */
export function ProductGrid({
	desserts,
	combos,
	stock,
	cart,
	searchQuery,
}: {
	/** Base desserts. */
	desserts: readonly Dessert[];
	/** Combos on sale. */
	combos: readonly ComboWithDetails[];
	stock: StockCounts;
	cart: PosCart;
	searchQuery: string;
}) {
	const [showOutOfStock, setShowOutOfStock] = useState(false);
	const rejectedAt = (tile: TileKey) => (cart.rejection?.tile === tile ? cart.rejection.id : undefined);

	const query = searchQuery.toLowerCase();
	const matches = (name: string) => name.toLowerCase().includes(query);
	const canSell = (dessert: Dessert) => isDessertOnSale(dessert) && isInStock(dessert, stock);
	const shownDesserts = desserts.filter((dessert) => matches(dessert.name));
	const onSale = shownDesserts.filter(canSell);
	const unavailable = shownDesserts.filter((dessert) => !canSell(dessert));
	// A combo sells from its base dessert's stock, so it leaves the menu when its base does.
	const sellableIds = new Set(desserts.filter(canSell).map((dessert) => dessert.id));
	const shownCombos = combos.filter(
		(combo) => sellableIds.has(combo.baseDessertId) && (matches(combo.name) || matches(combo.baseDessert.name)),
	);

	if (shownDesserts.length === 0 && shownCombos.length === 0) {
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
			{(shownCombos.length > 0 || onSale.length > 0) && (
				<section aria-label="Menu">
					<div className={TILE_GRID_CLASS}>
						<AnimatePresence mode="popLayout">
							{shownCombos.map((combo) => (
								<motion.div key={`combo-${combo.id}`} {...TILE_MOTION}>
									<ComboTile
										combo={combo}
										inCart={cart.quantityOf(`combo:${combo.id}`)}
										rejectedAt={rejectedAt(`combo:${combo.id}`)}
										onAdd={() => cart.addCombo(combo)}
									/>
								</motion.div>
							))}
							{onSale.map((dessert) => (
								<motion.div key={`dessert-${dessert.id}`} {...TILE_MOTION}>
									<DessertTile
										dessert={dessert}
										left={cart.remainingOf(dessert)}
										inCart={cart.quantityOf(`dessert:${dessert.id}`)}
										rejectedAt={rejectedAt(`dessert:${dessert.id}`)}
										onAdd={() => cart.addDessert(dessert)}
									/>
								</motion.div>
							))}
						</AnimatePresence>
					</div>
				</section>
			)}

			{unavailable.length > 0 && (
				<section>
					<h2>
						<button
							type="button"
							aria-expanded={showOutOfStock}
							aria-controls="pos-out-of-stock"
							onClick={() => setShowOutOfStock((current) => !current)}
							className="-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 text-left text-row text-foreground hover:bg-accent focus-ring"
						>
							<span>
								Out of stock
								<span className="ml-1.5 font-normal text-muted-foreground tabular-nums">{unavailable.length}</span>
							</span>
							<ChevronDown
								aria-hidden="true"
								className={cn(
									"size-5 text-muted-foreground transition-transform duration-enter",
									showOutOfStock && "rotate-180",
								)}
							/>
						</button>
					</h2>
					{showOutOfStock && (
						<div
							id="pos-out-of-stock"
							className={cn(
								TILE_GRID_CLASS,
								"mt-2 animate-in fade-in-0 duration-enter ease-out motion-reduce:animate-none",
							)}
						>
							{unavailable.map((dessert) => (
								<UnavailableDessertTile key={dessert.id} dessert={dessert} />
							))}
						</div>
					)}
				</section>
			)}
		</div>
	);
}
