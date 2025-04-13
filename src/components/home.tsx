"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ShoppingBag } from "lucide-react";
import { use, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Cart } from "@/components/cart";
import { DessertList } from "@/components/dessert-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CartItem, Dessert } from "@/lib/types";
import Bill from "./bill";

export const cartFormSchema = z.object({
	name: z.string().min(1),
	deliveryCost: z
		.string()
		.refine((val) => !Number.isNaN(Number.parseFloat(val)), {
			message: "Delivery cost must be a number",
		}),
});

export default function Home({ desserts }: { desserts: Promise<Dessert[]> }) {
	const items = use(desserts);
	const [cart, setCart] = useState<CartItem[]>([]);
	const form = useForm<z.infer<typeof cartFormSchema>>({
		resolver: zodResolver(cartFormSchema),
		defaultValues: {
			name: "",
			deliveryCost: "",
		},
	});

	const addToCart = (dessert: Dessert) => {
		const existingDessert = cart.find((item) => item.id === dessert.id);

		if (existingDessert) {
			setCart(
				cart.map((item) =>
					item.id === dessert.id
						? { ...item, quantity: item.quantity + 1 }
						: item,
				),
			);
		} else {
			setCart([...cart, { ...dessert, quantity: 1 }]);
		}
	};

	const removeFromCart = (dessertId: number) => {
		setCart(cart.filter((item) => item.id !== dessertId));
	};

	const updateQuantity = (dessertId: number, quantity: number) => {
		if (quantity <= 0) {
			removeFromCart(dessertId);
			return;
		}

		setCart(
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
	const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
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
				<div className="flex items-center justify-between mb-3">
					<h2 className="text-lg font-semibold">Deserts</h2>
					<div className="flex items-center gap-2">
						<ShoppingBag className="h-5 w-5" />
						<span className="font-medium">
							{totalItems} {totalItems === 1 ? "item" : "items"}
						</span>
					</div>
				</div>
				<DessertList desserts={items} addToCart={addToCart} />
			</div>

			<Card className="gap-2">
				<CardHeader>
					<CardTitle className="text-lg">Your Cart</CardTitle>
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

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-lg">Bill</CardTitle>
				</CardHeader>
				<CardContent>
					{cart.length > 0 ? (
						<Bill
							order={{
								items: cart,
								total: total,
								deliveryCost: Number.parseFloat(deliveryCost || "0"),
							}}
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
