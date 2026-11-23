"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { useLongPress } from "@/hooks/use-long-press";
import { formatINR } from "@/lib/format";
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

	const lineTotal = line.unitPrice * line.quantity;
	const meta = [
		lineView.hasModifiers ? lineView.modifierText : null,
		line.quantity > 1 ? `${formatINR(line.unitPrice)} each` : null,
	]
		.filter(Boolean)
		.join(" · ");
	const atMax = line.quantity >= MAX_ORDER_LINE_QUANTITY;
	// Phones get 44px steppers and remove; the inline (tablet/desktop) cart is compact from md.
	const stepClass = cn(
		"flex items-center justify-center text-foreground transition-colors focus-ring focus-visible:z-10",
		"hover:bg-accent active:bg-accent disabled:pointer-events-none disabled:text-muted-foreground/60",
		isTablet ? "size-11 md:size-9" : "size-11",
	);

	return (
		<motion.li
			layout
			initial={{ opacity: 0, y: -6 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, x: 20 }}
			transition={springSnappy}
			className={cn("bg-card", isTablet ? "px-3 py-2.5" : "px-4 py-3")}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<p className="line-clamp-2 text-[15px] leading-5 font-semibold capitalize">{lineView.displayName}</p>
					{meta ? <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{meta}</p> : null}
				</div>
				<p className="shrink-0 text-[15px] leading-5 font-semibold tabular-nums">{formatINR(lineTotal)}</p>
			</div>

			<div className="mt-2 flex items-center justify-between gap-2">
				<fieldset
					aria-label={`Quantity of ${lineView.displayName}`}
					className="m-0 flex min-w-0 items-center overflow-hidden rounded-lg border bg-card p-0"
				>
					<motion.button
						whileTap={{ scale: 0.94 }}
						type="button"
						aria-label={`Decrease ${lineView.displayName}`}
						className={stepClass}
						{...decrementLongPress()}
					>
						<Minus className={isTablet ? "size-5 md:size-4" : "size-5"} />
					</motion.button>
					<span
						className={cn(
							"min-w-9 border-x px-1 text-center font-semibold tabular-nums",
							isTablet ? "text-base leading-11 md:text-sm md:leading-9" : "text-base leading-11",
						)}
					>
						{line.quantity}
					</span>
					<motion.button
						whileTap={{ scale: 0.94 }}
						type="button"
						disabled={atMax}
						aria-label={`Increase ${lineView.displayName}`}
						className={stepClass}
						{...incrementLongPress()}
					>
						<Plus className={isTablet ? "size-5 md:size-4" : "size-5"} />
					</motion.button>
				</fieldset>
				<Button
					variant="ghost"
					size={isTablet ? "icon" : "icon-touch"}
					aria-label={`Remove ${lineView.displayName}`}
					onClick={() => removeFromCart(line.cartLineId)}
					className="-mr-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
				>
					<Trash2 />
				</Button>
			</div>
		</motion.li>
	);
}
