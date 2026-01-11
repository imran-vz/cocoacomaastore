import { Minus, Plus, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { useLongPress } from "@/hooks/use-long-press";
import type { CartLine } from "@/lib/types";
import { Button } from "./ui/button";

interface CartLineControlsProps {
	line: CartLine;
	updateQuantity: (cartLineId: string, quantity: number) => void;
	removeFromCart: (cartLineId: string) => void;
}

export function CartLineControls({
	line,
	updateQuantity,
	removeFromCart,
}: CartLineControlsProps) {
	const intervalRef = useRef<NodeJS.Timeout | null>(null);
	const quantityRef = useRef(line.quantity);

	// Sync ref when quantity changes externally
	useEffect(() => {
		quantityRef.current = line.quantity;
	}, [line.quantity]);

	// Cleanup interval on unmount
	useEffect(() => {
		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, []);

	const createQuantityHandler = (delta: number) => {
		return {
			threshold: 300,
			onCancel: () => {
				// Short press - single increment/decrement
				const newQty = quantityRef.current + delta;
				quantityRef.current = newQty;
				updateQuantity(line.cartLineId, newQty);
			},
			onFinish: () => {
				if (intervalRef.current) {
					clearInterval(intervalRef.current);
					intervalRef.current = null;
				}
			},
		};
	};

	const decrementHandlers = createQuantityHandler(-1);
	const incrementHandlers = createQuantityHandler(1);

	const decrementLongPress = useLongPress(() => {
		// Long press - start continuous decrement
		intervalRef.current = setInterval(() => {
			const nextQty = quantityRef.current - 1;
			quantityRef.current = nextQty;
			updateQuantity(line.cartLineId, nextQty);
			// Stop decrementing when item will be removed
			if (nextQty <= 0 && intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		}, 100);
	}, decrementHandlers);

	const incrementLongPress = useLongPress(() => {
		// Long press - start continuous increment
		intervalRef.current = setInterval(() => {
			const nextQty = quantityRef.current + 1;
			quantityRef.current = nextQty;
			updateQuantity(line.cartLineId, nextQty);
		}, 100);
	}, incrementHandlers);

	// Build display name
	const displayName = line.comboName ?? line.baseDessertName;
	const hasModifiers = line.modifiers.length > 0 && !line.comboName;

	return (
		<motion.div
			className="group flex flex-col py-3 last:pb-0 first:pt-0"
			initial={{ opacity: 0, x: -10 }}
			animate={{ opacity: 1, x: 0 }}
			exit={{
				opacity: 0,
				x: 10,
				height: 0,
				marginBottom: 0,
				padding: 0,
				overflow: "hidden",
			}}
			transition={{ duration: 0.2 }}
		>
			<div className="flex items-start justify-between gap-2 mb-2">
				<div className="flex-1 text-sm flex flex-col items-start gap-0.5">
					<h4 className="font-semibold leading-tight capitalize">
						{displayName}
					</h4>
					{hasModifiers && (
						<p className="text-xs text-muted-foreground leading-snug">
							+{" "}
							{line.modifiers
								.map((m) =>
									m.quantity > 1 ? `${m.quantity}× ${m.name}` : m.name,
								)
								.join(", ")}
						</p>
					)}
					<div className="text-xs font-mono text-muted-foreground mt-0.5">
						₹{line.unitPrice} × {line.quantity} = ₹
						{line.unitPrice * line.quantity}
					</div>
				</div>
				<motion.div whileTap={{ scale: 0.9 }}>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 focus-visible:text-destructive focus-visible:bg-destructive/10 -mt-1 -mr-1"
						onClick={() => removeFromCart(line.cartLineId)}
					>
						<span className="sr-only">Remove from cart</span>
						<Trash2 className="size-4" />
					</Button>
				</motion.div>
			</div>

			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center border rounded-md overflow-hidden bg-muted/20">
					<motion.div whileTap={{ scale: 0.9 }} className="h-full">
						<Button
							size="icon"
							variant="ghost"
							className="h-8 w-10 rounded-none hover:bg-muted"
							type="button"
							{...decrementLongPress()}
						>
							<span className="sr-only">Decrement quantity</span>
							<Minus className="size-3.5" />
						</Button>
					</motion.div>

					<div className="w-10 text-center text-sm font-semibold tabular-nums border-x bg-background h-8 flex items-center justify-center">
						{line.quantity}
					</div>

					<motion.div whileTap={{ scale: 0.9 }} className="h-full">
						<Button
							type="button"
							size="icon"
							variant="ghost"
							className="h-8 w-10 rounded-none hover:bg-muted"
							{...incrementLongPress()}
						>
							<span className="sr-only">Increment quantity</span>
							<Plus className="size-3.5" />
						</Button>
					</motion.div>
				</div>
			</div>
		</motion.div>
	);
}
