"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { use, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Cart } from "@/components/cart";
import { DessertList } from "@/components/dessert-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CartItem, Dessert } from "@/lib/types";
import Bill from "./bill";
import { cartFormSchema } from "./form-schema/cart";
import { Receipt } from "./receipt";
import { toast } from "sonner";

export default function Home({ desserts }: { desserts: Promise<Dessert[]> }) {
	const items = use(desserts);
	const [cart, setCart] = useState<CartItem[]>([]);
	const form = useForm<z.infer<typeof cartFormSchema>>({
		resolver: zodResolver(cartFormSchema),
		defaultValues: { name: "", deliveryCost: "" },
	});

	const addToCart = (dessert: Dessert) => {
		const existingDessert = cart.find((item) => item.id === dessert.id);

		if (existingDessert) {
			setCart((cart) =>
				cart.map((item) => {
					if (item.id === dessert.id && item.quantity < 99) {
						return {
							...item,
							quantity: item.quantity + 1,
						};
					}

					return item;
				}),
			);
		} else {
			setCart((cart) => [...cart, { ...dessert, quantity: 1 }]);
		}
	};

	const removeFromCart = (dessertId: number) => {
		setCart((cart) => cart.filter((item) => item.id !== dessertId));
	};

	const updateQuantity = (dessertId: number, quantity: number) => {
		if (quantity <= 0) {
			removeFromCart(dessertId);
			return;
		}

		if (quantity > 99) {
			toast.error("Quantity cannot be greater than 99");
			return;
		}

		setCart((cart) =>
			cart.map((item) =>
				item.id === dessertId ? { ...item, quantity } : item,
			),
		);
	};

	const clearCart = () => {
		setCart([]);
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	const deliveryCost = form.watch("deliveryCost");
	const total = useMemo(() => {
		const itemCost = cart.reduce(
			(sum, item) => sum + item.price * item.quantity,
			0,
		);
		const dc = Number.parseFloat(deliveryCost || "0");
		return itemCost + dc;
	}, [cart, deliveryCost]);

	return (
		<div className="flex flex-col gap-4">
			<div>
				<DessertList desserts={items} addToCart={addToCart} />
			</div>

			<Card className="gap-2">
				<CardHeader>
					<CardTitle className="text-lg">Cart</CardTitle>
				</CardHeader>
				<CardContent>
					<Cart
						cart={cart}
						updateQuantity={updateQuantity}
						removeFromCart={removeFromCart}
						total={total}
						clearCart={clearCart}
						form={form}
					/>
				</CardContent>
			</Card>

			<Card className="gap-2">
				<CardHeader className="flex items-center justify-between">
					<CardTitle className="text-lg">Receipt</CardTitle>
					<div className="max-w-52 w-full">
						<Bill
							order={{
								items: cart,
								total: total,
								deliveryCost: Number.parseFloat(deliveryCost || "0"),
							}}
						/>
					</div>
				</CardHeader>
				<CardContent>
					{cart.length > 0 ? (
						<Receipt
							cart={cart}
							total={total}
							clearCart={clearCart}
							deliveryCost={Number.parseFloat(deliveryCost || "0")}
						/>
					) : (
						<div className="text-center py-6 text-muted-foreground">
							<p>Add items to cart to see receipt</p>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
