"use client";

import { IconCake } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import type { ComboWithDetails, Dessert } from "@/lib/types";
import { ComboCard, ProductCard } from "./product-card";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "./ui/accordion";

interface ProductGridProps {
	desserts: Dessert[];
	combos?: ComboWithDetails[];
	onAddToCart: (dessert: Dessert) => void;
	onAddComboToCart?: (combo: ComboWithDetails) => void;
	onToggleStock?: (e: React.MouseEvent, dessert: Dessert) => void;
	stockToggleLoadingIds?: Set<number>;
	searchQuery?: string;
}

export function ProductGrid({
	desserts,
	combos = [],
	onAddToCart,
	onAddComboToCart,
	onToggleStock,
	stockToggleLoadingIds = new Set(),
	searchQuery = "",
}: ProductGridProps) {
	// Helper to check if dessert is unavailable
	const isUnavailable = (dessert: Dessert) =>
		dessert.isOutOfStock ||
		(!dessert.hasUnlimitedStock &&
			(dessert.inventoryQuantity === undefined ||
				dessert.inventoryQuantity <= 0));

	// Filter desserts based on search
	const filteredDesserts = desserts.filter((dessert) =>
		dessert.name.toLowerCase().includes(searchQuery.toLowerCase()),
	);

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
				className="flex flex-col items-center justify-center py-16 px-4 text-center"
			>
				<div className="size-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
					<IconCake className="size-8 text-muted-foreground/50" />
				</div>
				<h3 className="text-lg font-semibold text-foreground mb-1">
					No items found
				</h3>
				<p className="text-sm text-muted-foreground max-w-xs">
					{searchQuery
						? `No items match "${searchQuery}". Try a different search.`
						: "No items available at the moment."}
				</p>
			</motion.div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Combos Section */}
			{filteredCombos.length > 0 && onAddComboToCart && (
				<section>
					<motion.h2
						initial={{ opacity: 0, x: -10 }}
						animate={{ opacity: 1, x: 0 }}
						className="text-xs font-semibold text-primary uppercase tracking-wider mb-3 px-1"
					>
						🎁 Combos
					</motion.h2>
					<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3 auto-rows-fr">
						<AnimatePresence mode="popLayout">
							{filteredCombos.map((combo, index) => (
								<motion.div
									key={combo.id}
									initial={{ opacity: 0, y: 20 }}
									animate={{
										opacity: 1,
										y: 0,
										transition: { delay: index * 0.05 },
									}}
									exit={{ opacity: 0, scale: 0.95 }}
								>
									<ComboCard
										combo={combo}
										onAddToCart={() => onAddComboToCart(combo)}
									/>
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
						<motion.h2
							initial={{ opacity: 0, x: -10 }}
							animate={{ opacity: 1, x: 0 }}
							className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1"
						>
							All Items
						</motion.h2>
					)}
					<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3 auto-rows-fr">
						<AnimatePresence mode="popLayout">
							{availableDesserts.map((dessert, index) => (
								<motion.div
									key={dessert.id}
									initial={{ opacity: 0, y: 20 }}
									animate={{
										opacity: 1,
										y: 0,
										transition: { delay: index * 0.03 },
									}}
									exit={{ opacity: 0, scale: 0.95 }}
								>
									<ProductCard
										dessert={dessert}
										onAddToCart={onAddToCart}
										onToggleStock={onToggleStock}
										isStockToggleLoading={stockToggleLoadingIds.has(dessert.id)}
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
								<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3 pt-2 auto-rows-fr">
									<AnimatePresence mode="popLayout">
										{unavailableDesserts.map((dessert) => (
											<ProductCard
												key={dessert.id}
												dessert={dessert}
												onAddToCart={onAddToCart}
												onToggleStock={onToggleStock}
												isStockToggleLoading={stockToggleLoadingIds.has(
													dessert.id,
												)}
											/>
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
