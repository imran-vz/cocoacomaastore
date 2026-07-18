"use client";

import { Minus, Plus, Trash2, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef } from "react";

import { useLongPress } from "@/hooks/use-long-press";
import { springSnappy } from "@/lib/motion";
import { MAX_ORDER_LINE_QUANTITY } from "@/lib/order-limits";
import { getCartLineView } from "@/lib/pos-cart-behaviour";
import type { CartLine } from "@/lib/types";
import { cn } from "@/lib/utils";

type CartLinePresenterProps = {
	line: CartLine;
	variant: "mobile" | "tablet";
	updateQuantity: (cartLineId: string, quantity: number) => void;
	removeFromCart: (cartLineId: string) => void;
};

export function CartLinePresenter({ line, variant, updateQuantity, removeFromCart }: CartLinePresenterProps) {
	const intervalRef = useRef<NodeJS.Timeout | null>(null);
	const quantityRef = useRef(line.quantity);
	const lineView = getCartLineView(line);
	const isTablet = variant === "tablet";

	useEffect(() => {
		quantityRef.current = line.quantity;
	}, [line.quantity]);

	useEffect(() => {
		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, []);

	const createQuantityHandler = (delta: number) => ({
		threshold: 300,
		onCancel: () => {
			const newQty = quantityRef.current + delta;
			if (delta > 0 && newQty > MAX_ORDER_LINE_QUANTITY) return;
			quantityRef.current = newQty;
			updateQuantity(line.cartLineId, newQty);
		},
		onFinish: () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		},
	});

	const decrementLongPress = useLongPress(() => {
		intervalRef.current = setInterval(() => {
			const nextQty = quantityRef.current - 1;
			quantityRef.current = nextQty;
			updateQuantity(line.cartLineId, nextQty);
			if (nextQty <= 0 && intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		}, 100);
	}, createQuantityHandler(-1));

	const incrementLongPress = useLongPress(() => {
		intervalRef.current = setInterval(() => {
			const nextQty = quantityRef.current + 1;
			if (nextQty > MAX_ORDER_LINE_QUANTITY) {
				if (intervalRef.current) {
					clearInterval(intervalRef.current);
					intervalRef.current = null;
				}
				return;
			}
			quantityRef.current = nextQty;
			updateQuantity(line.cartLineId, nextQty);
		}, 100);
	}, createQuantityHandler(1));

	return (
		<motion.div
			layout
			initial={isTablet ? { opacity: 0, y: -10 } : { opacity: 0, x: -20 }}
			animate={isTablet ? { opacity: 1, y: 0 } : { opacity: 1, x: 0 }}
			exit={{ opacity: 0, x: 20 }}
			transition={springSnappy}
			className={cn(
				"bg-card rounded-xl p-3 border",
				isTablet ? "group relative hover:border-primary/20 transition-colors" : "shadow-sm",
			)}
		>
			{isTablet && (
				<motion.button
					type="button"
					onClick={() => removeFromCart(line.cartLineId)}
					whileTap={{ scale: 0.96 }}
					className={cn(
						"absolute -top-2 -right-2 size-6 rounded-full",
						"bg-destructive text-white shadow-md",
						"flex items-center justify-center",
						"opacity-0 group-hover:opacity-100 transition-opacity",
						"hover:bg-destructive/90",
					)}
				>
					<X className="size-3.5" />
				</motion.button>
			)}

			<div className={cn("flex items-start justify-between", isTablet ? "gap-2 mb-2" : "gap-3")}>
				<div className="flex-1 min-w-0">
					<h4 className="font-semibold text-sm leading-tight capitalize truncate">{lineView.displayName}</h4>
					{lineView.hasModifiers && (
						<p className={cn("text-muted-foreground mt-0.5 truncate", isTablet ? "text-[10px]" : "text-xs")}>
							{lineView.modifierText}
						</p>
					)}
					{!isTablet && <p className="text-xs text-muted-foreground mt-1 font-mono">{lineView.unitPriceText}</p>}
				</div>
				<p className={cn("font-bold text-sm text-primary", isTablet && "shrink-0")}>{lineView.lineTotalText}</p>
			</div>

			<div className={cn("flex items-center justify-between", isTablet ? "" : "mt-3 gap-2")}>
				{isTablet && <p className="text-[10px] text-muted-foreground font-mono">{lineView.unitPriceText}</p>}
				<div className="flex items-center bg-muted rounded-lg overflow-hidden">
					<motion.button
						whileTap={{ scale: 0.96 }}
						type="button"
						className={cn(
							"flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors",
							isTablet ? "h-7 w-8" : "h-9 w-10",
						)}
						{...decrementLongPress()}
					>
						<Minus className={isTablet ? "size-3" : "size-4"} />
					</motion.button>
					<span className={cn("text-center font-semibold tabular-nums", isTablet ? "w-7 text-xs" : "w-10 text-sm")}>
						{line.quantity}
					</span>
					<motion.button
						whileTap={{ scale: 0.96 }}
						type="button"
						disabled={line.quantity >= MAX_ORDER_LINE_QUANTITY}
						aria-label="Increase quantity"
						className={cn(
							"flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:pointer-events-none",
							isTablet ? "h-7 w-8" : "h-9 w-10",
						)}
						{...incrementLongPress()}
					>
						<Plus className={isTablet ? "size-3" : "size-4"} />
					</motion.button>
				</div>
				{!isTablet && (
					<motion.button
						whileTap={{ scale: 0.96 }}
						type="button"
						onClick={() => removeFromCart(line.cartLineId)}
						className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
					>
						<Trash2 className="size-4" />
					</motion.button>
				)}
			</div>
		</motion.div>
	);
}
