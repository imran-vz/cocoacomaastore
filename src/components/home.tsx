"use client";

import { useForm } from "@tanstack/react-form";
import { useStore } from "@tanstack/react-store";
import { use, useMemo, useState } from "react";
import { toast } from "sonner";

import { getCachedTodayInventory } from "@/app/manager/inventory/actions";
import { Cart } from "@/components/cart";
import { DessertList } from "@/components/dessert-list";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { UpiAccount } from "@/db/schema";
import type { CartItem, Dessert } from "@/lib/types";
import Bill from "./bill";
import { cartFormSchema } from "./form-schema/cart";
import { Receipt } from "./receipt";

export default function Home({
	desserts,
	upiAccounts,
	inventory,
}: {
	desserts: Promise<Dessert[]>;
	upiAccounts: Promise<UpiAccount[]>;
	inventory: Promise<Array<{ dessertId: number; quantity: number }>>;
}) {
	const items = use(desserts);
	const upiAccountsList = use(upiAccounts);
	const initialInventory = use(inventory);
	const [cart, setCart] = useState<CartItem[]>([]);
	const [inventoryByDessertId, setInventoryByDessertId] = useState<
		Record<number, number>
	>(() => {
		const next: Record<number, number> = {};
		for (const row of initialInventory) {
			next[row.dessertId] = row.quantity;
		}
		return next;
	});

	const form = useForm({
		defaultValues: { name: "", deliveryCost: "" },
		validators: {
			onChange: cartFormSchema,
		},
	});

	const dessertsWithInventory = useMemo(
		() =>
			items.map((dessert) => ({
				...dessert,
				inventoryQuantity: dessert.hasUnlimitedStock
					? undefined
					: (inventoryByDessertId[dessert.id] ?? 0),
			})),
		[items, inventoryByDessertId],
	);

	const refreshInventory = async () => {
		try {
			const latest = await getCachedTodayInventory();
			setInventoryByDessertId(() => {
				const next: Record<number, number> = {};
				for (const row of latest) {
					next[row.dessertId] = row.quantity;
				}
				return next;
			});
		} catch (error) {
			console.error(error);
		}
	};

	const addToCart = (dessert: Dessert) => {
		const available = dessert.hasUnlimitedStock
			? Number.POSITIVE_INFINITY
			: (dessert.inventoryQuantity ?? 0);
		if (available <= 0) {
			toast.error("Out of stock — set today's inventory");
			return;
		}

		const existingDessert = cart.find((item) => item.id === dessert.id);

		if (existingDessert) {
			if (existingDessert.quantity >= available) {
				toast.error(`Only ${available} left`);
				return;
			}

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

		const dessert = items.find((d) => d.id === dessertId);
		const available = dessert?.hasUnlimitedStock
			? Number.POSITIVE_INFINITY
			: (inventoryByDessertId[dessertId] ?? 0);
		if (available <= 0) {
			toast.error("Out of stock — set today's inventory");
			removeFromCart(dessertId);
			return;
		}
		if (quantity > available) {
			setCart((cart) =>
				cart.map((item) =>
					item.id === dessertId ? { ...item, quantity: available } : item,
				),
			);
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

	const deliveryCost = useStore(
		form.store,
		(state) => state.values.deliveryCost,
	);
	const name = useStore(form.store, (state) => state.values.name);
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
				<DessertList desserts={dessertsWithInventory} addToCart={addToCart} />
			</div>

			{/* Cart & Receipt Section - Takes 1 column on MD+ screens */}
			<div className="flex flex-col gap-4 md:sticky md:top-20">
				<Card className="gap-2">
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
					<CardHeader>
						<Bill
							order={{
								items: cart,
								total: total,
								deliveryCost: Number.parseFloat(deliveryCost || "0"),
							}}
							upiAccounts={upiAccountsList}
						/>
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
								onOrderSaved={refreshInventory}
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
