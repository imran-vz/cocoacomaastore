"use client";

import { useLongPress } from "@react-aria/interactions";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useRef } from "react";
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

					<motion.div
						className="overflow-y-auto overflow-x-hidden max-h-[220px]"
						animate={{ height: cart.length > 0 ? "auto" : 0 }}
						transition={{ duration: 0.3 }}
					>
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
					</motion.div>
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

	const createQuantityHandler = (delta: number) => {
		const handlePress = () => {
			updateQuantity(item.id, item.quantity + delta);
		};

		const handleLongPressStart = () => {
			intervalRef.current = setInterval(() => {
				updateQuantity(item.id, item.quantity + delta);
			}, 100);
		};

		const handleLongPressEnd = () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};

		return { handlePress, handleLongPressStart, handleLongPressEnd };
	};

	const decrementHandler = createQuantityHandler(-1);
	const incrementHandler = createQuantityHandler(1);

	const { longPressProps: decrementLongPressProps } = useLongPress({
		onLongPressStart: decrementHandler.handleLongPressStart,
		onLongPressEnd: decrementHandler.handleLongPressEnd,
		onLongPress: decrementHandler.handlePress,
		threshold: 300,
	});

	const { longPressProps: incrementLongPressProps } = useLongPress({
		onLongPressStart: incrementHandler.handleLongPressStart,
		onLongPressEnd: incrementHandler.handleLongPressEnd,
		onLongPress: incrementHandler.handlePress,
		threshold: 300,
	});

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
						{...decrementLongPressProps}
						onClick={decrementHandler.handlePress}
					>
						<Minus className="h-3 w-3" />
					</Button>
					<motion.span
						className="w-6 text-center text-sm"
						key={item.quantity}
						initial={{ scale: 1.3 }}
						animate={{ scale: 1 }}
						transition={{ duration: 0.2 }}
					>
						{item.quantity}
					</motion.span>
					<Button
						type="button"
						size="icon"
						className="h-7 w-7"
						{...incrementLongPressProps}
						onClick={incrementHandler.handlePress}
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
