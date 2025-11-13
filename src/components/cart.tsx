"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
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
	const currentQuantityRef = useRef(item.quantity);

	// Keep ref in sync with current quantity
	useEffect(() => {
		currentQuantityRef.current = item.quantity;
	}, [item.quantity]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
		};
	}, []);

	const createQuantityHandler = (delta: number) => ({
		onCancel: () => {
			const newQuantity = currentQuantityRef.current + delta;
			currentQuantityRef.current = newQuantity;
			updateQuantity(item.id, newQuantity);
		},
		onLongPress: () => {
			intervalRef.current = setInterval(() => {
				const nextQuantity = currentQuantityRef.current + delta;
				currentQuantityRef.current = nextQuantity;
				updateQuantity(item.id, nextQuantity);
			}, 200);
		},
		onFinish: () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		},
	});

	const decrementHandlers = useLongPress(
		createQuantityHandler(-1).onLongPress,
		createQuantityHandler(-1),
	);

	const incrementHandlers = useLongPress(
		createQuantityHandler(1).onLongPress,
		createQuantityHandler(1),
	);

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
						type="button"
						{...decrementHandlers}
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
						{...incrementHandlers}
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
