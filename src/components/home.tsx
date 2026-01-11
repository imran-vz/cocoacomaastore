"use client";

import { useForm } from "@tanstack/react-form";
import { useStore } from "@tanstack/react-store";
import { use, useMemo, useState } from "react";
import { toast } from "sonner";

import type { ModifierDessert } from "@/app/combos/actions";
import { getCachedTodayInventory } from "@/app/manager/inventory/actions";
import { Cart } from "@/components/cart";
import { DessertList } from "@/components/dessert-list";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { UpiAccount } from "@/db/schema";
import type { CartLine, ComboWithDetails, Dessert } from "@/lib/types";
import Bill from "./bill";
import { cartFormSchema } from "./form-schema/cart";
import { Receipt } from "./receipt";

function generateCartLineId(): string {
	return `cl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function Home({
	desserts,
	upiAccounts,
	inventory,
	combos,
	modifierDesserts,
}: {
	desserts: Promise<Dessert[]>;
	upiAccounts: Promise<UpiAccount[]>;
	inventory: Promise<Array<{ dessertId: number; quantity: number }>>;
	combos: Promise<ComboWithDetails[]>;
	modifierDesserts: Promise<ModifierDessert[]>;
}) {
	const items = use(desserts);
	const upiAccountsList = use(upiAccounts);
	const initialInventory = use(inventory);
	const combosList = use(combos);
	const modifiersList = use(modifierDesserts);

	const [cart, setCart] = useState<CartLine[]>([]);
	const [inventoryByDessertId, setInventoryByDessertId] = useState<
		Record<number, number>
	>(() => {
		const next: Record<number, number> = {};
		for (const row of initialInventory) {
			next[row.dessertId] = row.quantity;
		}
		return next;
	});

	const dessertById = useMemo(() => {
		const map = new Map<number, Dessert>();
		for (const dessert of items) {
			map.set(dessert.id, dessert);
		}
		return map;
	}, [items]);

	const availableCombos = useMemo(() => {
		return combosList.filter((combo) => {
			const base = dessertById.get(combo.baseDessertId);
			if (!base) return false;
			if (base.isOutOfStock) return false;
			if (!base.hasUnlimitedStock) {
				const stock = inventoryByDessertId[base.id] ?? 0;
				if (stock <= 0) return false;
			}
			return true;
		});
	}, [combosList, dessertById, inventoryByDessertId]);

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

	// Calculate used inventory in cart per base dessert
	const cartInventoryUsage = useMemo(() => {
		const usage = new Map<number, number>();
		for (const line of cart) {
			const current = usage.get(line.baseDessertId) ?? 0;
			usage.set(line.baseDessertId, current + line.quantity);
		}
		return usage;
	}, [cart]);

	// Add a simple base dessert to cart (no modifiers)
	const addToCart = (dessert: Dessert) => {
		const available = dessert.hasUnlimitedStock
			? Number.POSITIVE_INFINITY
			: (inventoryByDessertId[dessert.id] ?? 0);
		const usedInCart = cartInventoryUsage.get(dessert.id) ?? 0;
		const remaining = available - usedInCart;

		if (remaining <= 0) {
			toast.error("Out of stock — set today's inventory");
			return;
		}

		// Check if there's already a cart line for this base dessert with no modifiers
		const existingLine = cart.find(
			(line) =>
				line.baseDessertId === dessert.id && line.modifiers.length === 0,
		);

		if (existingLine) {
			const currentQuantityInCart = existingLine.quantity;
			if (currentQuantityInCart >= available) {
				toast.error(`Only ${available} left`);
				return;
			}

			setCart((cart) =>
				cart.map((line) => {
					if (
						line.cartLineId === existingLine.cartLineId &&
						line.quantity < 199
					) {
						return {
							...line,
							quantity: line.quantity + 1,
						};
					}
					return line;
				}),
			);
		} else {
			const newLine: CartLine = {
				cartLineId: generateCartLineId(),
				baseDessertId: dessert.id,
				baseDessertName: dessert.name,
				baseDessertPrice: dessert.price,
				hasUnlimitedStock: dessert.hasUnlimitedStock,
				modifiers: [],
				unitPrice: dessert.price,
				quantity: 1,
			};
			setCart((cart) => [...cart, newLine]);
		}
	};

	// Add a combo to cart
	const addComboToCart = (combo: ComboWithDetails) => {
		const baseDessert = dessertById.get(combo.baseDessertId);
		if (!baseDessert) {
			toast.error("Base dessert not found");
			return;
		}

		const available = baseDessert.hasUnlimitedStock
			? Number.POSITIVE_INFINITY
			: (inventoryByDessertId[baseDessert.id] ?? 0);
		const usedInCart = cartInventoryUsage.get(baseDessert.id) ?? 0;
		const remaining = available - usedInCart;

		if (remaining <= 0) {
			toast.error("Out of stock — set today's inventory");
			return;
		}

		// Check if there's already a cart line for this combo
		const existingLine = cart.find((line) => line.comboId === combo.id);

		if (existingLine) {
			const currentQuantityInCart = existingLine.quantity;
			if (currentQuantityInCart >= available) {
				toast.error(`Only ${available} left`);
				return;
			}

			setCart((cart) =>
				cart.map((line) => {
					if (
						line.cartLineId === existingLine.cartLineId &&
						line.quantity < 199
					) {
						return {
							...line,
							quantity: line.quantity + 1,
						};
					}
					return line;
				}),
			);
		} else {
			// Build modifiers from combo items
			const modifiers = combo.items.map((item) => ({
				dessertId: item.dessert.id,
				name: item.dessert.name,
				price: item.dessert.price,
				quantity: item.quantity,
			}));

			// Compute unit price
			const modifierTotal = modifiers.reduce(
				(sum, mod) => sum + mod.price * mod.quantity,
				0,
			);
			const unitPrice =
				combo.overridePrice ?? combo.baseDessert.price + modifierTotal;

			const newLine: CartLine = {
				cartLineId: generateCartLineId(),
				baseDessertId: combo.baseDessertId,
				baseDessertName: combo.baseDessert.name,
				baseDessertPrice: combo.baseDessert.price,
				hasUnlimitedStock: combo.baseDessert.hasUnlimitedStock,
				modifiers,
				unitPrice,
				quantity: 1,
				comboId: combo.id,
				comboName: combo.name,
			};

			setCart((cart) => [...cart, newLine]);
		}
	};

	const removeFromCart = (cartLineId: string) => {
		setCart((cart) => cart.filter((line) => line.cartLineId !== cartLineId));
	};

	const updateQuantity = (cartLineId: string, quantity: number) => {
		if (quantity <= 0) {
			removeFromCart(cartLineId);
			return;
		}

		const line = cart.find((l) => l.cartLineId === cartLineId);
		if (!line) return;

		const dessert = dessertById.get(line.baseDessertId);
		if (!dessert) return;

		const available = dessert.hasUnlimitedStock
			? Number.POSITIVE_INFINITY
			: (inventoryByDessertId[line.baseDessertId] ?? 0);

		// Calculate how much is used by OTHER lines with same base dessert
		const usedByOthers = cart
			.filter(
				(l) =>
					l.baseDessertId === line.baseDessertId && l.cartLineId !== cartLineId,
			)
			.reduce((sum, l) => sum + l.quantity, 0);

		const maxAllowed = available - usedByOthers;

		if (maxAllowed <= 0) {
			toast.error("Out of stock — set today's inventory");
			removeFromCart(cartLineId);
			return;
		}

		if (quantity > maxAllowed) {
			setCart((cart) =>
				cart.map((l) =>
					l.cartLineId === cartLineId ? { ...l, quantity: maxAllowed } : l,
				),
			);
			toast.error(`Only ${maxAllowed} available`);
			return;
		}

		if (quantity > 199) {
			toast.error("Quantity cannot be greater than 99");
			return;
		}

		setCart((cart) =>
			cart.map((l) => (l.cartLineId === cartLineId ? { ...l, quantity } : l)),
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
			(sum, line) => sum + line.unitPrice * line.quantity,
			0,
		);
		const dc = Number.parseFloat(deliveryCost || "0");
		return itemCost + dc;
	}, [cart, deliveryCost]);

	return (
		<div className="flex flex-col md:grid md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 md:items-start">
			{/* Desserts Section - Takes 1 column on MD+, 2 columns on XL+ */}
			<div className="xl:col-span-2">
				<DessertList
					desserts={dessertsWithInventory}
					addToCart={addToCart}
					combos={availableCombos}
					addComboToCart={addComboToCart}
					modifiers={modifiersList}
				/>
			</div>

			{/* Cart & Receipt Section - Takes 1 column on MD+ screens */}
			<div className="flex flex-col gap-4 md:sticky md:top-20">
				<Card className="overflow-hidden shadow-sm border-2">
					<CardContent className="p-3 sm:p-4">
						<Cart
							cart={cart}
							updateQuantity={updateQuantity}
							removeFromCart={removeFromCart}
							form={form}
						/>
					</CardContent>
				</Card>

				<Card className="overflow-hidden gap-0 shadow-sm border-2">
					<CardHeader className="p-3 sm:p-4 pb-0">
						<Bill
							order={{
								lines: cart,
								total: total,
								deliveryCost: Number.parseFloat(deliveryCost || "0"),
							}}
							upiAccounts={upiAccountsList}
						/>
					</CardHeader>
					<CardContent className="p-3 sm:p-4 pt-3">
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
							<div className="text-center py-6 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
								<p className="text-sm font-medium">Receipt Preview</p>
								<p className="text-xs mt-1">Add items to view details</p>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
