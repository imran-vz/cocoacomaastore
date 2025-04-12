"use client";

import { Cart } from "@/components/cart";
import { DessertList } from "@/components/dessert-list";
import { Receipt } from "@/components/receipt";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CartItem, Dessert } from "@/lib/types";
import { ShoppingBag } from "lucide-react";
import { useState } from "react";

export function Inventory({ desserts }: { desserts: Dessert[] }) {
	const [cart, setCart] = useState<CartItem[]>([]);

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

	const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
	const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

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
				<DessertList desserts={desserts} addToCart={addToCart} />
			</div>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-lg">Your Cart</CardTitle>
				</CardHeader>
				<CardContent>
					<Cart
						cart={cart}
						updateQuantity={updateQuantity}
						removeFromCart={removeFromCart}
						total={total}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-lg">Receipt</CardTitle>
				</CardHeader>
				<CardContent>
					{cart.length > 0 ? (
						<Receipt cart={cart} total={total} clearCart={clearCart} />
					) : (
						<div className="text-center py-6 text-muted-foreground">
							<p>Add items to cart and checkout to see receipt</p>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
