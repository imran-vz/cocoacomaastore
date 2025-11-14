"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { use, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { Cart } from "@/components/cart";
import { DessertList } from "@/components/dessert-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UpiAccount } from "@/db/schema";
import type { CartItem, Dessert } from "@/lib/types";
import Bill from "./bill";
import { cartFormSchema } from "./form-schema/cart";
import { Receipt } from "./receipt";

export default function Home({
	desserts,
	upiAccounts,
}: {
	desserts: Promise<Dessert[]>;
	upiAccounts: Promise<UpiAccount[]>;
}) {
	const items = use(desserts);
	const upiAccountsList = use(upiAccounts);
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
					if (item.id === dessert.id && item.quantity < 199) {
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

		if (quantity > 199) {
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
		form.reset();
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	const deliveryCost = form.watch("deliveryCost");
	const name = form.watch("name");
	const total = useMemo(() => {
		const itemCost = cart.reduce(
			(sum, item) => sum + item.price * item.quantity,
			0,
		);
		const dc = Number.parseFloat(deliveryCost || "0");
		return itemCost + dc;
	}, [cart, deliveryCost]);

	return (
		<div className="flex flex-col md:grid md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 md:items-start">
			{/* Desserts Section - Takes 1 column on MD+, 2 columns on XL+ */}
			<div className="xl:col-span-2">
				<DessertList desserts={items} addToCart={addToCart} />
			</div>

			{/* Cart & Receipt Section - Takes 1 column on MD+ screens */}
			<div className="flex flex-col gap-4 md:sticky md:top-20">
				<Card className="gap-2">
					<CardHeader>
						<CardTitle className="text-lg">Cart</CardTitle>
					</CardHeader>
					<CardContent>
						<Cart
							cart={cart}
							updateQuantity={updateQuantity}
							removeFromCart={removeFromCart}
							form={form}
						/>
					</CardContent>
				</Card>

				<Card className="gap-2">
					<CardHeader className="flex gap-3 items-start justify-between">
						<CardTitle className="text-lg">Receipt</CardTitle>
						<div className="">
							<Bill
								order={{
									items: cart,
									total: total,
									deliveryCost: Number.parseFloat(deliveryCost || "0"),
								}}
								upiAccounts={upiAccountsList}
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
								upiAccounts={upiAccountsList}
								customerName={name}
							/>
						) : (
							<div className="text-center py-6 text-muted-foreground">
								<p>Add items to cart to see receipt</p>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
