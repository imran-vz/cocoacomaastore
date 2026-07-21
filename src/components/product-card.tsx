"use client";

import { Check, CircleAlert, Plus, X } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useState } from "react";
import { useReactiveButton } from "@/components/ui/reactive-button";
import { tweenEnter } from "@/lib/motion";
import type { Dessert } from "@/lib/types";
import { cn } from "@/lib/utils";

// Sized icons for the render-prop stock-toggle host (design-system button svg sizing
// is not applied to custom hosts, so icons carry their own size classes).
const StockSpinnerIcon = ({ className }: { className?: string }) => (
	<span
		aria-hidden="true"
		className={cn("size-3 animate-spin rounded-full border-2 border-current border-r-transparent", className)}
	/>
);
const StockCheckIcon = ({ className }: { className?: string }) => <Check className={cn("size-3", className)} />;
const StockAlertIcon = ({ className }: { className?: string }) => <CircleAlert className={cn("size-3", className)} />;

// The round add-indicator flashes green on a successful add and red when the cart
// reducer rejects the add (out of stock / limit); null is the resting "+" state.
type AddFlashStatus = "added" | "rejected" | null;

interface ProductCardProps {
	dessert: Dessert;
	onAddToCart: (dessert: Dessert) => boolean;
	onToggleStock?: (dessert: Dessert) => Promise<string>;
	onToggleStockComplete?: (dessertId: number) => void;
	isStockToggleLoading?: boolean;
	stockToggleIsOutOfStock?: boolean;
	compact?: boolean;
}

export function ProductCard({
	dessert,
	onAddToCart,
	onToggleStock,
	onToggleStockComplete,
	isStockToggleLoading = false,
	stockToggleIsOutOfStock,
	compact = false,
}: ProductCardProps) {
	const [addFlash, setAddFlash] = useState<AddFlashStatus>(null);

	const inventoryQty = dessert.inventoryQuantity;
	const isInventoryOutOfStock = !dessert.hasUnlimitedStock && inventoryQty !== undefined && inventoryQty <= 0;
	const isUnavailable = dessert.isOutOfStock || isInventoryOutOfStock || isStockToggleLoading;
	const stockToggleAction = (stockToggleIsOutOfStock ?? dessert.isOutOfStock) ? "Set Available" : "Mark Unavailable";

	const handleAddToCart = useCallback(() => {
		if (isUnavailable) return;
		const ok = onAddToCart(dessert);
		setAddFlash(ok ? "added" : "rejected");
		setTimeout(() => setAddFlash(null), 600);
	}, [dessert, isUnavailable, onAddToCart]);

	const [stockButton, StockButton] = useReactiveButton({
		label: stockToggleAction,
		icon: null,
		loading: { label: "", icon: StockSpinnerIcon },
		success: { label: "Updated", icon: StockCheckIcon, duration: 1200 },
		error: { label: "Failed", icon: StockAlertIcon, duration: 1200 },
		feedbackStyle: "neutral",
	});

	const handleToggleStock = useCallback(
		async (e: React.MouseEvent) => {
			e.stopPropagation();
			if (!onToggleStock || stockButton.status !== "idle") return;
			const token = stockButton.setLoading();
			try {
				const message = await onToggleStock(dessert);
				stockButton.setSuccess(message, {
					token,
					onComplete: () => onToggleStockComplete?.(dessert.id),
				});
			} catch {
				stockButton.setError(undefined, { token });
			}
		},
		[dessert, onToggleStock, onToggleStockComplete, stockButton],
	);

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
			transition={tweenEnter}
			className="group relative select-none h-full"
		>
			<motion.button
				type="button"
				onClick={handleAddToCart}
				disabled={isUnavailable}
				whileTap={!isUnavailable ? { scale: 0.97 } : undefined}
				className={cn(
					"w-full h-full text-left rounded-2xl bg-card border-2 overflow-hidden transition-[border-color,box-shadow] duration-200",
					"focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
					"flex flex-col",
					isUnavailable
						? "opacity-60 cursor-not-allowed border-border"
						: "border-border hover:border-primary/30 hover:shadow-md active:border-primary/50",
					compact ? "p-2.5" : "p-4",
				)}
			>
				<div className="relative z-10 flex flex-col flex-1">
					{/* Header: Name & Price */}
					<div className={cn("flex items-start justify-between gap-2", compact ? "mb-1" : "mb-1.5")}>
						<h3
							className={cn(
								"font-semibold leading-tight",
								compact ? "text-[13px] line-clamp-2" : "text-base",
								isUnavailable && "line-through text-muted-foreground",
							)}
						>
							{dessert.name}
						</h3>
						<span
							className={cn(
								"shrink-0 font-bold tabular-nums",
								compact ? "text-[13px]" : "text-base",
								isUnavailable ? "text-muted-foreground" : "text-primary",
							)}
						>
							₹{dessert.price}
						</span>
					</div>

					{/* Description */}
					{dessert.description && !compact && (
						<p className="text-xs text-muted-foreground line-clamp-2 mb-2.5 leading-relaxed">{dessert.description}</p>
					)}

					{/* Footer: Stock & Add Button */}
					<div className={cn("flex items-center justify-between gap-2 mt-auto", compact ? "pt-1.5" : "pt-2")}>
						{getStockBadge()}

						{!isUnavailable && (
							<div
								className={cn(
									"ml-auto flex items-center justify-center rounded-full transition-colors",
									compact ? "size-7" : "size-9",
									addFlash === "added"
										? "bg-green-500 text-white"
										: addFlash === "rejected"
											? "bg-red-500 text-white"
											: "bg-primary/10 text-primary hover:bg-primary/20",
								)}
							>
								{addFlash === "added" ? (
									<Check className={cn(compact ? "size-3.5" : "size-5")} />
								) : addFlash === "rejected" ? (
									<X className={cn(compact ? "size-3.5" : "size-5")} />
								) : (
									<Plus className={cn(compact ? "size-3.5" : "size-5")} />
								)}
							</div>
						)}
					</div>
				</div>
			</motion.button>

			{/* Stock Toggle (for managers) */}
			{onToggleStock && (
				<StockButton
					onClick={handleToggleStock}
					aria-label={`${stockToggleAction} ${dessert.name}`}
					render={
						<motion.button
							type="button"
							whileTap={{ scale: 0.95 }}
							className={cn(
								"absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full",
								"text-[10px] font-medium px-2 py-1 rounded-b-lg",
								"bg-muted/80 backdrop-blur-sm border border-t-0 border-border",
								"opacity-0 group-hover:opacity-100 transition-opacity motion-reduce:transition-none",
								stockButton.status !== "idle" && "opacity-100",
								dessert.isOutOfStock
									? "text-green-600 hover:text-green-700"
									: "text-muted-foreground hover:text-destructive",
							)}
						/>
					}
				/>
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
	onAddToCart: () => boolean;
	compact?: boolean;
}

export function ComboCard({ combo, onAddToCart, compact = false }: ComboCardProps) {
	const [addFlash, setAddFlash] = useState<AddFlashStatus>(null);

	// Compute display price
	const modifierTotal = combo.items.reduce((sum, item) => sum + item.dessert.price * item.quantity, 0);
	const displayPrice = combo.overridePrice ?? combo.baseDessert.price + modifierTotal;

	const handleAddToCart = useCallback(() => {
		const ok = onAddToCart();
		setAddFlash(ok ? "added" : "rejected");
		setTimeout(() => setAddFlash(null), 600);
	}, [onAddToCart]);

	const comboDescription =
		combo.baseDessert.name +
		(combo.items.length > 0
			? ` + ${combo.items
					.map((item) => (item.quantity > 1 ? `${item.quantity}× ${item.dessert.name}` : item.dessert.name))
					.join(", ")}`
			: "");

	return (
		<motion.div
			layout
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.95 }}
			transition={tweenEnter}
			className="group relative select-none h-full"
		>
			<motion.button
				type="button"
				onClick={handleAddToCart}
				whileTap={{ scale: 0.97 }}
				className={cn(
					"w-full h-full text-left rounded-2xl bg-linear-to-br from-primary/5 to-primary/10 border-2 border-primary/20 overflow-hidden transition-[border-color,box-shadow] duration-200",
					"focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
					"hover:border-primary/40 hover:shadow-md active:border-primary/50",
					compact ? "p-2.5" : "p-4",
				)}
			>
				<div className="relative z-10 flex flex-col h-full">
					{/* Header */}
					<div className="flex items-center justify-between gap-2 mb-1">
						<span className="text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
							Combo
						</span>
						<span className={cn("shrink-0 font-bold text-primary tabular-nums", compact ? "text-[13px]" : "text-base")}>
							₹{displayPrice}
						</span>
					</div>

					{/* Name */}
					<h3 className={cn("font-semibold leading-tight line-clamp-1 mb-0.5", compact ? "text-[13px]" : "text-base")}>
						{combo.name}
					</h3>

					{/* Description */}
					<p
						className={cn(
							"text-[11px] text-muted-foreground line-clamp-1 leading-relaxed",
							compact ? "" : "text-xs line-clamp-2",
						)}
					>
						{comboDescription}
					</p>

					{/* Add Button */}
					<div className={cn("flex justify-end mt-auto", compact ? "pt-1.5" : "pt-2")}>
						<div
							className={cn(
								"flex items-center justify-center rounded-full transition-colors",
								compact ? "size-7" : "size-9",
								addFlash === "added"
									? "bg-green-500 text-white"
									: addFlash === "rejected"
										? "bg-red-500 text-white"
										: "bg-primary text-primary-foreground",
							)}
						>
							{addFlash === "added" ? (
								<Check className={cn(compact ? "size-3.5" : "size-5")} />
							) : addFlash === "rejected" ? (
								<X className={cn(compact ? "size-3.5" : "size-5")} />
							) : (
								<Plus className={cn(compact ? "size-3.5" : "size-5")} />
							)}
						</div>
					</div>
				</div>
			</motion.button>
		</motion.div>
	);
}
