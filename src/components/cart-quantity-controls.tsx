import { Minus, Plus, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useRef } from "react";
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

	const createQuantityHandler = (delta: number) => {
		return {
			threshold: 300,
			onCancel: () => {
				// Short press - single increment
				const newQty = item.quantity + delta;
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
		// Long press callback - start interval
		intervalRef.current = setInterval(() => {
			const nextQty = item.quantity - 1;
			updateQuantity(item.id, nextQty);
		}, 100);
	}, decrementHandlers);

	const incrementLongPress = useLongPress(() => {
		// Long press callback - start interval
		intervalRef.current = setInterval(() => {
			const nextQty = item.quantity + 1;
			updateQuantity(item.id, nextQty);
		}, 100);
	}, incrementHandlers);

	return (
		<motion.div
			className="flex items-center py-2 border-b last:border-b-0 select-none"
			initial={{ opacity: 0, x: -20 }}
			animate={{ opacity: 1, x: 0 }}
			exit={{ opacity: 0, x: 20 }}
			transition={{ duration: 0.3 }}
		>
			<div className="flex-1">
				<h4 className="font-medium text-sm capitalize">{item.name}</h4>
				<p className="text-xs text-muted-foreground">{item.price.toFixed(2)}</p>
			</div>
			<div className="flex items-center gap-4">
				<div className="flex items-center gap-2">
					<Button
						size="icon"
						className="size-10"
						type="button"
						{...decrementLongPress()}
					>
						<Minus className="size-4" />
					</Button>
					<span className="w-6 text-center text-sm">{item.quantity}</span>
					<Button
						type="button"
						size="icon"
						className="size-10"
						{...incrementLongPress()}
					>
						<Plus className="size-4" />
					</Button>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-7 text-destructive"
					onClick={() => removeFromCart(item.id)}
				>
					<Trash2 className="size-4" />
				</Button>
			</div>
		</motion.div>
	);
}
