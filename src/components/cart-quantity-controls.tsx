import { Minus, Plus, Trash2, XIcon } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { useLongPress } from "@/hooks/use-long-press";
import type { CartItem } from "@/lib/types";
import { Button } from "./ui/button";

interface QuantityControlsProps {
	item: CartItem;
	updateQuantity: (dessertId: number, quantity: number) => void;
	removeFromCart: (dessertId: number) => void;
}

export function QuantityControls({
	item,
	updateQuantity,
	removeFromCart,
}: QuantityControlsProps) {
	const intervalRef = useRef<NodeJS.Timeout | null>(null);
	const quantityRef = useRef(item.quantity);

	// Sync ref when quantity changes externally
	useEffect(() => {
		quantityRef.current = item.quantity;
	}, [item]);

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
				updateQuantity(item.id, newQty);
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
			updateQuantity(item.id, nextQty);
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
			updateQuantity(item.id, nextQty);
		}, 100);
	}, incrementHandlers);

	return (
		<motion.div
			className="flex items-center py-2 border-b last:border-b-0 gap-2"
			initial={{ opacity: 0, x: -20 }}
			animate={{ opacity: 1, x: 0 }}
			exit={{ opacity: 0, x: 20 }}
			transition={{ duration: 0.3 }}
		>
			<motion.div whileTap={{ scale: 0.9 }}>
				<Button
					size="icon"
					className="size-10"
					type="button"
					{...decrementLongPress()}
				>
					<span className="sr-only">Decrement quantity</span>
					<Minus className="size-4" />
				</Button>
			</motion.div>

			<div className="flex-1 text-sm flex items-center justify-start gap-2">
				<h4 className="font-medium capitalize">{item.name}</h4>
			</div>

			<div className="flex items-center gap-1">
				<XIcon className="size-3 text-muted-foreground" />
				<p className="text-xs text-muted-foreground mr-2 font-medium font-mono">
					{item.quantity.toString().padStart(2, "0")}
				</p>
			</div>
			<motion.div whileTap={{ scale: 0.9 }}>
				<Button
					type="button"
					size="icon"
					className="size-10"
					{...incrementLongPress()}
				>
					<span className="sr-only">Increment quantity</span>
					<Plus className="size-4" />
				</Button>
			</motion.div>
			<motion.div whileTap={{ scale: 0.9 }} className="ml-2">
				<Button
					type="button"
					variant="destructive"
					size="icon"
					className="size-10"
					onClick={() => removeFromCart(item.id)}
				>
					<span className="sr-only">Remove from cart</span>
					<Trash2 className="size-4" />
				</Button>
			</motion.div>
		</motion.div>
	);
}
