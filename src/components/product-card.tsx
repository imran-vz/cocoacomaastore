"use client";

import { Check, CircleAlert, Plus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useReactiveButton } from "@/components/ui/reactive-button";
import { formatCount, formatINR } from "@/lib/format";
import { tweenEnter, tweenFast } from "@/lib/motion";
import type { Dessert } from "@/lib/types";
import { cn } from "@/lib/utils";

// Tracked stock below this reads as "Low" (warning) instead of plain muted text.
const LOW_STOCK_THRESHOLD = 5;

const StockSpinnerIcon = ({ className }: { className?: string }) => (
	<span
		aria-hidden="true"
		className={cn("size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent", className)}
	/>
);
const StockCheckIcon = ({ className }: { className?: string }) => <Check className={cn("size-3.5", className)} />;
const StockAlertIcon = ({ className }: { className?: string }) => <CircleAlert className={cn("size-3.5", className)} />;

/**
 * Flashes the trailing slot when the cart reducer rejects an add (out of stock / line limit).
 * A successful add needs no flash: the in-cart count badge pops instead.
 */
function useRejectFlash() {
	const [rejected, setRejected] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
	const flash = useCallback((ok: boolean) => {
		if (ok) return;
		setRejected(true);
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => setRejected(false), 700);
	}, []);
	return [rejected, flash] as const;
}

/**
 * Trailing slot of a tile: a quiet "+" at rest, the in-cart count (22px primary circle)
 * once the item is in the cart, and a short destructive "×" when an add is rejected.
 */
function TileSlot({ quantity, rejected }: { quantity: number; rejected: boolean }) {
	if (rejected) {
		return (
			<span className="flex size-5.5 items-center justify-center rounded-full bg-destructive/10 text-destructive">
				<X className="size-3.5" strokeWidth={2.5} />
			</span>
		);
	}
	if (quantity > 0) {
		return (
			<AnimatePresence initial={false} mode="popLayout">
				<motion.span
					key={quantity}
					initial={{ scale: 1.35 }}
					animate={{ scale: 1 }}
					transition={tweenFast}
					className="flex h-5.5 min-w-5.5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground tabular-nums"
				>
					{quantity > 99 ? "99+" : quantity}
				</motion.span>
			</AnimatePresence>
		);
	}
	return (
		<span className="flex size-5.5 items-center justify-center text-muted-foreground/70 transition-colors group-hover/tile:text-foreground">
			<Plus className="size-4.5" strokeWidth={2} />
		</span>
	);
}

/**
 * One tile style for every sellable thing on the POS grid (DESIGN.md decision 13):
 * name first (up to three lines, X1-7), a muted meta line, then the price with the trailing slot.
 * The whole tile is the add button; in-cart tiles get a brand tint, a ring and the count.
 */
function tileShellClass({ inCart, interactive }: { inCart: boolean; interactive: boolean }) {
	return cn(
		"group/tile relative flex h-full min-h-27 w-full flex-col rounded-xl border p-3 text-left shadow-xs transition-[background-color,border-color,box-shadow] duration-150 focus-ring",
		inCart
			? "border-primary/40 bg-[color-mix(in_oklab,var(--primary)_5%,var(--card))] ring-[0.5px] ring-primary/40"
			: "bg-card",
		interactive && !inCart && "hover:bg-accent active:bg-accent",
		interactive && inCart && "hover:bg-[color-mix(in_oklab,var(--primary)_8%,var(--card))]",
	);
}

function TileBody({
	name,
	meta,
	price,
	trailing,
	priceMuted = false,
}: {
	name: string;
	meta?: React.ReactNode;
	price: number;
	trailing?: React.ReactNode;
	priceMuted?: boolean;
}) {
	return (
		<>
			<span className="line-clamp-3 text-[15px] leading-5 font-semibold text-pretty text-foreground">{name}</span>
			{meta ? <span className="mt-1 flex min-h-5 items-center text-[13px] text-muted-foreground">{meta}</span> : null}
			<span className="mt-auto flex items-end justify-between gap-2 pt-2">
				<span
					className={cn(
						"text-[15px] leading-5 font-semibold tabular-nums",
						priceMuted ? "text-muted-foreground" : "text-foreground",
					)}
				>
					{formatINR(price)}
				</span>
				{trailing}
			</span>
		</>
	);
}

interface ProductCardProps {
	dessert: Dessert;
	/** How many of this dessert (as a plain line, not via a combo) are already in the cart. */
	cartQuantity?: number;
	onAddToCart: (dessert: Dessert) => boolean;
	onToggleStock?: (dessert: Dessert) => Promise<string>;
	onToggleStockComplete?: (dessertId: number) => void;
	isStockToggleLoading?: boolean;
	stockToggleIsOutOfStock?: boolean;
}

export function ProductCard({
	dessert,
	cartQuantity = 0,
	onAddToCart,
	onToggleStock,
	onToggleStockComplete,
	isStockToggleLoading = false,
	stockToggleIsOutOfStock,
}: ProductCardProps) {
	const [rejected, flashReject] = useRejectFlash();

	const inventoryQty = dessert.inventoryQuantity;
	const isInventoryOutOfStock = !dessert.hasUnlimitedStock && inventoryQty !== undefined && inventoryQty <= 0;
	const isUnavailable = dessert.isOutOfStock || isInventoryOutOfStock || isStockToggleLoading;
	// The stock control only ever restores stock — marking an item unavailable from the grid
	// was too easy to hit by accident. Use the pinned value so the control survives the flash.
	const canRestock = stockToggleIsOutOfStock ?? dessert.isOutOfStock;
	const stockToggleAction = "Restock";
	const showRestock = Boolean(onToggleStock) && canRestock;
	// The restock control sits inside the tile, so the tile cannot be a <button> while it is
	// on screen (buttons do not nest). Unavailable tiles are not addable anyway.
	const isInert = isUnavailable || showRestock;

	const handleAddToCart = useCallback(() => {
		if (isUnavailable) return;
		flashReject(onAddToCart(dessert));
	}, [dessert, flashReject, isUnavailable, onAddToCart]);

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

	let meta: React.ReactNode = null;
	if (isUnavailable) {
		meta = <Badge variant="destructive">Out of stock</Badge>;
	} else if (inventoryQty !== undefined) {
		meta =
			inventoryQty < LOW_STOCK_THRESHOLD ? (
				<Badge variant="warning">{formatCount(inventoryQty, "left")}</Badge>
			) : (
				<span className="tabular-nums">{formatCount(inventoryQty, "left")}</span>
			);
	}

	const inCart = cartQuantity > 0 && !isInert;

	return (
		<motion.div
			layout
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={tweenEnter}
			className="h-full select-none"
		>
			{isInert ? (
				<div className={tileShellClass({ inCart: false, interactive: false })}>
					<TileBody
						name={dessert.name}
						meta={meta}
						price={dessert.price}
						priceMuted
						trailing={
							showRestock ? (
								<StockButton
									onClick={handleToggleStock}
									aria-label={`${stockToggleAction} ${dessert.name}`}
									variant="outline"
									size="sm"
									className="-my-1 -mr-1"
								/>
							) : null
						}
					/>
				</div>
			) : (
				<motion.button
					type="button"
					onClick={handleAddToCart}
					whileTap={{ scale: 0.97 }}
					aria-label={`${dessert.name} ${formatINR(dessert.price)}${cartQuantity > 0 ? `, ${cartQuantity} in cart` : ""}`}
					className={tileShellClass({ inCart, interactive: true })}
				>
					<TileBody
						name={dessert.name}
						meta={meta}
						price={dessert.price}
						trailing={<TileSlot quantity={cartQuantity} rejected={rejected} />}
					/>
				</motion.button>
			)}
		</motion.div>
	);
}

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
	cartQuantity?: number;
	onAddToCart: () => boolean;
}

export function ComboCard({ combo, cartQuantity = 0, onAddToCart }: ComboCardProps) {
	const [rejected, flashReject] = useRejectFlash();

	const modifierTotal = combo.items.reduce((sum, item) => sum + item.dessert.price * item.quantity, 0);
	const displayPrice = combo.overridePrice ?? combo.baseDessert.price + modifierTotal;

	const handleAddToCart = useCallback(() => {
		flashReject(onAddToCart());
	}, [flashReject, onAddToCart]);

	const inCart = cartQuantity > 0;

	return (
		<motion.div
			layout
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={tweenEnter}
			className="h-full select-none"
		>
			<motion.button
				type="button"
				onClick={handleAddToCart}
				whileTap={{ scale: 0.97 }}
				aria-label={`${combo.name} combo ${formatINR(displayPrice)}${inCart ? `, ${cartQuantity} in cart` : ""}`}
				className={tileShellClass({ inCart, interactive: true })}
			>
				<TileBody
					name={combo.name}
					meta="Combo"
					price={displayPrice}
					trailing={<TileSlot quantity={cartQuantity} rejected={rejected} />}
				/>
			</motion.button>
		</motion.div>
	);
}
