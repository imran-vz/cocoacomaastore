"use client";

import { motion, useAnimation } from "framer-motion";
import { Check, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import type { Dessert } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProductCardProps {
	dessert: Dessert;
	onAddToCart: (dessert: Dessert) => void;
	onToggleStock?: (e: React.MouseEvent, dessert: Dessert) => void;
	isStockToggleLoading?: boolean;
	compact?: boolean;
}

export function ProductCard({
	dessert,
	onAddToCart,
	onToggleStock,
	isStockToggleLoading = false,
	compact = false,
}: ProductCardProps) {
	const [showAdded, setShowAdded] = useState(false);
	const overlayControls = useAnimation();
	const buttonControls = useAnimation();

	const inventoryQty = dessert.inventoryQuantity;
	const isInventoryOutOfStock =
		!dessert.hasUnlimitedStock &&
		inventoryQty !== undefined &&
		inventoryQty <= 0;
	const isUnavailable = dessert.isOutOfStock || isInventoryOutOfStock;

	const handleAddToCart = useCallback(async () => {
		if (isUnavailable) return;

		// Add to cart immediately
		onAddToCart(dessert);

		// Show added feedback
		setShowAdded(true);

		// Run overlay animation
		overlayControls.stop();
		overlayControls.set({ scaleX: 0, originX: 0 });
		await overlayControls.start({
			scaleX: 1,
			transition: { duration: 0.2, ease: "easeOut" },
		});
		await overlayControls.start({
			scaleX: 0,
			originX: 1,
			transition: { duration: 0.2, ease: "easeIn" },
		});

		// Button bounce
		buttonControls.start({
			scale: [1, 1.2, 1],
			transition: { duration: 0.3 },
		});

		setTimeout(() => setShowAdded(false), 600);
	}, [dessert, isUnavailable, onAddToCart, overlayControls, buttonControls]);

	const getStockBadge = () => {
		if (isUnavailable) {
			return (
				<span className="inline-flex items-center px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] font-semibold">
					Out of Stock
				</span>
			);
		}

		if (inventoryQty !== undefined) {
			const isLow = inventoryQty < 5;
			return (
				<span
					className={cn(
						"inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold",
						isLow
							? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
							: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
					)}
				>
					{inventoryQty} left
				</span>
			);
		}

		return null;
	};

	return (
		<motion.div
			layout
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.95 }}
			transition={{ duration: 0.2 }}
			className="relative select-none h-full"
		>
			<motion.button
				type="button"
				onClick={handleAddToCart}
				disabled={isUnavailable}
				whileTap={!isUnavailable ? { scale: 0.97 } : undefined}
				className={cn(
					"w-full h-full text-left rounded-2xl bg-card border-2 overflow-hidden transition-all duration-200",
					"focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
					"flex flex-col",
					isUnavailable
						? "opacity-60 cursor-not-allowed border-border"
						: "border-border hover:border-primary/30 hover:shadow-md active:border-primary/50",
					compact ? "p-3" : "p-4",
				)}
			>
				{/* Success overlay */}
				<motion.div
					className="absolute inset-0 bg-green-500/15 pointer-events-none rounded-2xl"
					initial={{ scaleX: 0 }}
					animate={overlayControls}
				/>

				<div className="relative z-10 flex flex-col flex-1">
					{/* Header: Name & Price */}
					<div className="flex items-start justify-between gap-2 mb-1.5">
						<h3
							className={cn(
								"font-semibold leading-tight",
								compact ? "text-sm" : "text-base",
								isUnavailable && "line-through text-muted-foreground",
							)}
						>
							{dessert.name}
						</h3>
						<span
							className={cn(
								"shrink-0 font-bold tabular-nums",
								compact ? "text-sm" : "text-base",
								isUnavailable ? "text-muted-foreground" : "text-primary",
							)}
						>
							₹{dessert.price}
						</span>
					</div>

					{/* Description */}
					{dessert.description && !compact && (
						<p className="text-xs text-muted-foreground line-clamp-2 mb-2.5 leading-relaxed">
							{dessert.description}
						</p>
					)}

					{/* Footer: Stock & Add Button */}
					<div className="flex items-center justify-between gap-2 mt-auto pt-2">
						{getStockBadge()}

						{!isUnavailable && (
							<motion.div
								animate={buttonControls}
								className={cn(
									"ml-auto flex items-center justify-center rounded-full transition-colors",
									compact ? "size-8" : "size-9",
									showAdded
										? "bg-green-500 text-white"
										: "bg-primary/10 text-primary hover:bg-primary/20",
								)}
							>
								{showAdded ? (
									<Check className={cn(compact ? "size-4" : "size-5")} />
								) : (
									<Plus className={cn(compact ? "size-4" : "size-5")} />
								)}
							</motion.div>
						)}
					</div>
				</div>
			</motion.button>

			{/* Stock Toggle (for managers) */}
			{onToggleStock && (
				<motion.button
					type="button"
					onClick={(e) => onToggleStock(e, dessert)}
					disabled={isStockToggleLoading}
					whileTap={{ scale: 0.95 }}
					className={cn(
						"absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full",
						"text-[10px] font-medium px-2 py-1 rounded-b-lg",
						"bg-muted/80 backdrop-blur-sm border border-t-0 border-border",
						"opacity-0 group-hover:opacity-100 transition-opacity",
						dessert.isOutOfStock
							? "text-green-600 hover:text-green-700"
							: "text-muted-foreground hover:text-destructive",
					)}
				>
					{isStockToggleLoading ? (
						<span className="size-3 animate-spin rounded-full border-2 border-current border-r-transparent inline-block" />
					) : dessert.isOutOfStock ? (
						"Set Available"
					) : (
						"Mark Unavailable"
					)}
				</motion.button>
			)}
		</motion.div>
	);
}

// Combo variant of the product card
interface ComboCardProps {
	combo: {
		id: number;
		name: string;
		baseDessert: {
			id: number;
			name: string;
			price: number;
			hasUnlimitedStock: boolean;
		};
		items: Array<{
			id: number;
			dessertId: number;
			quantity: number;
			dessert: {
				id: number;
				name: string;
				price: number;
			};
		}>;
		overridePrice: number | null;
	};
	onAddToCart: () => void;
	compact?: boolean;
}

export function ComboCard({
	combo,
	onAddToCart,
	compact = false,
}: ComboCardProps) {
	const [showAdded, setShowAdded] = useState(false);
	const overlayControls = useAnimation();
	const buttonControls = useAnimation();

	// Compute display price
	const modifierTotal = combo.items.reduce(
		(sum, item) => sum + item.dessert.price * item.quantity,
		0,
	);
	const displayPrice =
		combo.overridePrice ?? combo.baseDessert.price + modifierTotal;

	const handleAddToCart = useCallback(async () => {
		onAddToCart();

		setShowAdded(true);

		overlayControls.stop();
		overlayControls.set({ scaleX: 0, originX: 0 });
		await overlayControls.start({
			scaleX: 1,
			transition: { duration: 0.2, ease: "easeOut" },
		});
		await overlayControls.start({
			scaleX: 0,
			originX: 1,
			transition: { duration: 0.2, ease: "easeIn" },
		});

		buttonControls.start({
			scale: [1, 1.2, 1],
			transition: { duration: 0.3 },
		});

		setTimeout(() => setShowAdded(false), 600);
	}, [onAddToCart, overlayControls, buttonControls]);

	const comboDescription =
		combo.baseDessert.name +
		(combo.items.length > 0
			? ` + ${combo.items
					.map((item) =>
						item.quantity > 1
							? `${item.quantity}× ${item.dessert.name}`
							: item.dessert.name,
					)
					.join(", ")}`
			: "");

	return (
		<motion.div
			layout
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.95 }}
			transition={{ duration: 0.2 }}
			className="relative select-none h-full"
		>
			<motion.button
				type="button"
				onClick={handleAddToCart}
				whileTap={{ scale: 0.97 }}
				className={cn(
					"w-full h-full text-left rounded-2xl bg-linear-to-br from-primary/5 to-primary/10 border-2 border-primary/20 overflow-hidden transition-all duration-200",
					"focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
					"hover:border-primary/40 hover:shadow-md active:border-primary/50",
					compact ? "p-3" : "p-4",
				)}
			>
				{/* Success overlay */}
				<motion.div
					className="absolute inset-0 bg-green-500/15 pointer-events-none rounded-2xl"
					initial={{ scaleX: 0 }}
					animate={overlayControls}
				/>

				<div className="relative z-10 flex flex-col h-full">
					{/* Header */}
					<div className="flex items-start justify-between gap-2 mb-1">
						<span className="text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
							Combo
						</span>
						<span
							className={cn(
								"shrink-0 font-bold text-primary tabular-nums",
								compact ? "text-sm" : "text-base",
							)}
						>
							₹{displayPrice}
						</span>
					</div>

					{/* Name */}
					<h3
						className={cn(
							"font-semibold leading-tight line-clamp-2 mb-1",
							compact ? "text-sm" : "text-base",
						)}
					>
						{combo.name}
					</h3>

					{/* Description */}
					<p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed flex-1">
						{comboDescription}
					</p>

					{/* Add Button */}
					<div className="flex justify-end mt-2">
						<motion.div
							animate={buttonControls}
							className={cn(
								"flex items-center justify-center rounded-full transition-colors",
								compact ? "size-8" : "size-9",
								showAdded
									? "bg-green-500 text-white"
									: "bg-primary text-primary-foreground",
							)}
						>
							{showAdded ? (
								<Check className={cn(compact ? "size-4" : "size-5")} />
							) : (
								<Plus className={cn(compact ? "size-4" : "size-5")} />
							)}
						</motion.div>
					</div>
				</div>
			</motion.button>
		</motion.div>
	);
}
