"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { createOrder } from "@/app/orders/actions";
import { Button } from "@/components/ui/button";
import type { CartItem } from "@/lib/types";
import type { cartFormSchema } from "./home";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";
import { Separator } from "@radix-ui/react-separator";

interface CartProps {
	cart: CartItem[];
	updateQuantity: (dessertId: number, quantity: number) => void;
	removeFromCart: (dessertId: number) => void;
	total: number;
	clearCart: () => void;
	form: UseFormReturn<z.infer<typeof cartFormSchema>>;
}

export function Cart({
	cart,
	updateQuantity,
	removeFromCart,
	total,
	clearCart,
	form,
}: CartProps) {
	const [isLoading, setIsLoading] = useState(false);

	const handleCheckout = async (values: z.infer<typeof cartFormSchema>) => {
		setIsLoading(true);
		try {
			await createOrder({
				customerName: values.name,
				deliveryCost: Number.parseFloat(values.deliveryCost).toFixed(2),
				items: cart,
			});
			clearCart();
			form.reset();
			toast.success("Order created successfully");
		} catch (error) {
			console.error(error);
			toast.error("Something went wrong");
		} finally {
			setIsLoading(false);
		}
	};
	if (cart.length === 0) {
		return (
			<div className="text-center py-6 text-muted-foreground">
				<p>Your cart is empty</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col">
			<Form {...form}>
				<form
					onSubmit={form.handleSubmit(handleCheckout)}
					className="space-y-4"
				>
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
											className="max-w-48"
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
												className="max-w-48"
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
							<div
								key={item.id}
								className="flex items-center py-2 border-b last:border-b-0"
							>
								<div className="flex-1">
									<h4 className="font-medium text-sm">{item.name}</h4>
									<p className="text-xs text-muted-foreground">
										{item.price.toFixed(2)}
									</p>
								</div>
								<div className="flex items-center gap-2">
									<Button
										variant="outline"
										size="icon"
										className="h-7 w-7"
										onClick={() => updateQuantity(item.id, item.quantity - 1)}
										type="button"
									>
										<Minus className="h-3 w-3" />
									</Button>
									<span className="w-6 text-center text-sm">
										{item.quantity}
									</span>
									<Button
										type="button"
										variant="outline"
										size="icon"
										className="h-7 w-7"
										onClick={() => updateQuantity(item.id, item.quantity + 1)}
									>
										<Plus className="h-3 w-3" />
									</Button>
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
						))}
					</div>

					<Separator className="h-px bg-slate-300" />

					<div className="flex justify-between">
						<p className="font-medium">Total:</p>
						<p className="text-sm font-medium">₹{total.toFixed(2)}</p>
					</div>
					<div className="flex justify-end">
						<Button variant="outline" type="submit">
							{isLoading ? "Processing..." : "Checkout"}
						</Button>
					</div>
				</form>
			</Form>
		</div>
	);
}
