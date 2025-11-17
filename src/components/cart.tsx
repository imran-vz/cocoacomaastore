"use client";

import { AnimatePresence } from "framer-motion";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";

import type { CartItem } from "@/lib/types";
import { QuantityControls } from "./cart-quantity-controls";
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

					<div className="max-h-72 overflow-y-auto overflow-x-hidden">
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
