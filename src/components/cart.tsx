"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { createOrder } from "@/app/orders/actions";
import { Button } from "@/components/ui/button";
import type { CartItem } from "@/lib/types";
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
	total: number;
	clearCart: () => void;
}

const formSchema = z.object({
	name: z.string().min(1),
	deliveryCost: z
		.string()
		.refine((val) => !Number.isNaN(Number.parseFloat(val)), {
			message: "Delivery cost must be a number",
		}),
});

export function Cart({
	cart,
	updateQuantity,
	removeFromCart,
	total,
	clearCart,
}: CartProps) {
	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			deliveryCost: "0.00",
		},
	});

	const [isLoading, setIsLoading] = useState(false);

	const handleCheckout = async (values: z.infer<typeof formSchema>) => {
		setIsLoading(true);
		try {
			await createOrder({
				customerName: values.name,
				deliveryCost: values.deliveryCost,
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
				<div className="mb-4">
					<form onSubmit={form.handleSubmit(handleCheckout)}>
						<div className="flex gap-4 flex-col">
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem className="flex">
										<FormLabel className="shrink-0 min-w-24">Name</FormLabel>
										<FormControl>
											<Input placeholder="Customer Name" {...field} />
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
										<div className="flex">
											<FormLabel className="shrink-0 min-w-24">
												Delivery Cost
											</FormLabel>
											<FormControl>
												<Input placeholder="Delivery Cost" {...field} />
											</FormControl>
										</div>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className="overflow-auto max-h-[200px]">
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
						<div className="flex justify-between mt-4">
							<p className="text-sm">Total:</p>
							<p className="text-sm font-medium">
								₹
								{(
									total + Number.parseFloat(form.watch("deliveryCost") || "0")
								).toFixed(2)}
							</p>
						</div>
						<div className="flex justify-end mt-4">
							<Button variant="outline" type="submit">
								{isLoading ? "Processing..." : "Checkout"}
							</Button>
						</div>
					</form>
				</div>
			</Form>
		</div>
	);
}
