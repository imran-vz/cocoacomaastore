"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { useLongPress } from "@/hooks/use-long-press";
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
				<form className="space-y-3">
					<div className="space-y-3">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
										Customer Name
									</FormLabel>
									<FormControl>
										<Input
											placeholder="Enter name"
											{...field}
											className="h-10 rounded-lg border-neutral-200 focus:ring-2 focus:ring-offset-0 placeholder:text-neutral-400 text-sm"
										/>
									</FormControl>
									<FormMessage className="text-xs" />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="deliveryCost"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
										Delivery Cost (₹)
									</FormLabel>
									<FormControl>
										<Input
											placeholder="0"
											type="number"
											step="0.01"
											min="0"
											{...field}
											className="h-10 rounded-lg border-neutral-200 focus:ring-2 focus:ring-offset-0 placeholder:text-neutral-400 text-sm"
										/>
									</FormControl>
									<FormMessage className="text-xs" />
								</FormItem>
							)}
						/>
					</div>

					<div className="overflow-y-auto overflow-x-hidden max-h-[220px]">
						<AnimatePresence mode="popLayout">
							{cart.map((item) => (
								<QuantityControls
									key={item.id}
									item={item}
									updateQuantity={updateQuantity}
									removeFromCart={removeFromCart}
								/>
							))}
						</AnimatePresence>
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
	const quantityRef = useRef(item.quantity);

	const createQuantityHandler = (delta: number) => {
		return {
			onCancel: () => {
				// Short press - single increment
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

	const decrementLongPress = useLongPress(
		() => {
			// Long press callback - start interval
			intervalRef.current = setInterval(() => {
				const nextQty = quantityRef.current - 1;
				quantityRef.current = nextQty;
				updateQuantity(item.id, nextQty);
			}, 100);
		},
		{
			threshold: 300,
			...decrementHandlers,
		},
	);

	const incrementLongPress = useLongPress(
		() => {
			// Long press callback - start interval
			intervalRef.current = setInterval(() => {
				const nextQty = quantityRef.current + 1;
				quantityRef.current = nextQty;
				updateQuantity(item.id, nextQty);
			}, 100);
		},
		{
			threshold: 300,
			...incrementHandlers,
		},
	);

	return (
		<motion.div
			className="flex items-center py-2 border-b last:border-b-0"
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
						className="h-7 w-7"
						type="button"
						{...decrementLongPress()}
					>
						<Minus className="h-3 w-3" />
					</Button>
					<span className="w-6 text-center text-sm">{item.quantity}</span>
					<Button
						type="button"
						size="icon"
						className="h-7 w-7"
						{...incrementLongPress()}
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
		</motion.div>
	);
}
