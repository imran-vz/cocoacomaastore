"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import type { CartItem } from "@/lib/types";
import type { cartFormSchema } from "./form-schema/cart";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";
import { SlidingNumber } from "./ui/sliding-number";

interface CartProps {
	cart: CartItem[];
	updateQuantity: (dessertId: number, quantity: number) => void;
	removeFromCart: (dessertId: number) => void;
	form: UseFormReturn<z.infer<typeof cartFormSchema>>;
}

export function Cart({
	cart,
	updateQuantity,
	removeFromCart,
	form,
}: CartProps) {
	return (
		<div className="flex flex-col">
			<Form {...form}>
				<form className="space-y-4">
					<div className="flex gap-4 flex-col">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem className="flex gap-2 justify-between">
									<FormLabel className="shrink-0">Name</FormLabel>
									<FormControl>
										<Input
											placeholder="Customer Name"
											{...field}
											className="max-w-52"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="deliveryCost"
							render={({ field }) => (
								<FormItem>
									<div className="flex gap-2 justify-between">
										<FormLabel className="shrink-0">Delivery Cost</FormLabel>
										<FormControl>
											<Input
												placeholder="Delivery Cost"
												{...field}
												className="max-w-52"
											/>
										</FormControl>
									</div>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<div className="overflow-auto max-h-[220px]">
						{cart.map((item) => (
							<QuantityControls
								key={item.id}
								item={item}
								updateQuantity={updateQuantity}
								removeFromCart={removeFromCart}
							/>
						))}
					</div>
				</form>
			</Form>
		</div>
	);
}

interface QuantityControlsProps {
	item: CartItem;
	updateQuantity: (dessertId: number, quantity: number) => void;
	removeFromCart: (dessertId: number) => void;
}

function QuantityControls({
	item,
	updateQuantity,
	removeFromCart,
}: QuantityControlsProps) {
	const intervalRef = useRef<NodeJS.Timeout | null>(null);
	const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const currentQuantityRef = useRef(item.quantity);
	const deltaRef = useRef<number>(0);

	// Keep ref in sync with current quantity
	useEffect(() => {
		currentQuantityRef.current = item.quantity;
	}, [item.quantity]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (longPressTimeoutRef.current) {
				clearTimeout(longPressTimeoutRef.current);
			}
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
		};
	}, []);

	const startLongPress = (
		delta: number,
		e?: React.TouchEvent | React.MouseEvent,
	) => {
		e?.preventDefault();
		deltaRef.current = delta;
		// Initial click
		const newQuantity = currentQuantityRef.current + delta;
		currentQuantityRef.current = newQuantity;
		updateQuantity(item.id, newQuantity);

		// Set timeout for long press detection (500ms)
		longPressTimeoutRef.current = setTimeout(() => {
			// Start interval for continuous updates (every 200ms)
			intervalRef.current = setInterval(() => {
				const nextQuantity = currentQuantityRef.current + deltaRef.current;
				currentQuantityRef.current = nextQuantity;
				updateQuantity(item.id, nextQuantity);
			}, 200);
		}, 500);
	};

	const stopLongPress = () => {
		if (longPressTimeoutRef.current) {
			clearTimeout(longPressTimeoutRef.current);
			longPressTimeoutRef.current = null;
		}
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
		deltaRef.current = 0;
	};

	const handleDecrement = () => {
		updateQuantity(item.id, item.quantity - 1);
	};

	const handleIncrement = () => {
		updateQuantity(item.id, item.quantity + 1);
	};

	return (
		<div className="flex items-center py-2 border-b last:border-b-0">
			<div className="flex-1">
				<h4 className="font-medium text-sm capitalize">{item.name}</h4>
				<p className="text-xs text-muted-foreground">{item.price.toFixed(2)}</p>
			</div>
			<div className="flex items-center gap-4">
				<div className="flex items-center gap-2">
					<Button
						size="icon"
						className="h-7 w-7"
						onClick={handleDecrement}
						onMouseDown={(e) => startLongPress(-1, e)}
						onMouseUp={stopLongPress}
						onMouseLeave={stopLongPress}
						onTouchStart={(e) => startLongPress(-1, e)}
						onTouchEnd={stopLongPress}
						type="button"
					>
						<Minus className="h-3 w-3" />
					</Button>
					<span className="w-6 text-center text-sm">
						<SlidingNumber value={item.quantity} />
					</span>
					<Button
						type="button"
						size="icon"
						className="h-7 w-7"
						onClick={handleIncrement}
						onMouseDown={(e) => startLongPress(1, e)}
						onMouseUp={stopLongPress}
						onMouseLeave={stopLongPress}
						onTouchStart={(e) => startLongPress(1, e)}
						onTouchEnd={stopLongPress}
					>
						<Plus className="h-3 w-3" />
					</Button>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="h-7 w-7 text-destructive"
					onClick={() => removeFromCart(item.id)}
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}
