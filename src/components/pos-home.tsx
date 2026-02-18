"use client";

import { useForm } from "@tanstack/react-form";
import { useStore } from "@tanstack/react-store";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { ModifierDessert } from "@/app/combos/actions";
import { toggleOutOfStock } from "@/app/desserts/actions";
import { getCachedTodayInventory } from "@/app/manager/inventory/actions";
import type { UpiAccount } from "@/db/schema";
import type { CartLine, ComboWithDetails, Dessert } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDessertStore } from "@/store/dessert-store";
import { CheckoutSheet } from "./checkout-sheet";
import { cartFormSchema } from "./form-schema/cart";
import { MobileCartSheet } from "./mobile-cart-sheet";
import { ProductGrid } from "./product-grid";
import { TabletCartSidebar } from "./tablet-cart-sidebar";

function generateCartLineId(): string {
	return `cl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

interface POSHomeProps {
	desserts: Promise<Dessert[]>;
	upiAccounts: Promise<UpiAccount[]>;
	inventory: Promise<Array<{ dessertId: number; quantity: number }>>;
	combos: Promise<ComboWithDetails[]>;
	modifierDesserts: Promise<ModifierDessert[]>;
}

export default function POSHome({
	desserts,
	upiAccounts,
	inventory,
	combos,
	modifierDesserts: _modifierDesserts,
}: POSHomeProps) {
	const items = use(desserts);
	const upiAccountsList = use(upiAccounts);
	const initialInventory = use(inventory);
	const combosList = use(combos);

	const [cart, setCart] = useState<CartLine[]>([]);
	const [showCheckout, setShowCheckout] = useState(false);
	const [inventoryByDessertId, setInventoryByDessertId] = useState<
		Record<number, number>
	>(() => {
		const next: Record<number, number> = {};
		for (const row of initialInventory) {
			next[row.dessertId] = row.quantity;
		}
		return next;
	});

	const {
		searchQuery,
		setSearchQuery,
		localDesserts,
		setLocalDesserts,
		stockToggleLoadingIds,
		addStockToggleLoadingId,
		removeStockToggleLoadingId,
		updateDessert,
	} = useDessertStore();

	// Sync local desserts with prop
	useEffect(() => {
		setLocalDesserts(items);
	}, [items, setLocalDesserts]);

	const dessertById = useMemo(() => {
		const map = new Map<number, Dessert>();
		for (const dessert of localDesserts) {
			map.set(dessert.id, dessert);
		}
		return map;
	}, [localDesserts]);

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
		validators: { onChange: cartFormSchema },
	});

	const dessertsWithInventory = useMemo(
		() =>
			localDesserts.map((dessert) => ({
				...dessert,
				inventoryQuantity: dessert.hasUnlimitedStock
					? undefined
					: (inventoryByDessertId[dessert.id] ?? 0),
			})),
		[localDesserts, inventoryByDessertId],
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

	const cartInventoryUsage = useMemo(() => {
		const usage = new Map<number, number>();
		for (const line of cart) {
			const current = usage.get(line.baseDessertId) ?? 0;
			usage.set(line.baseDessertId, current + line.quantity);
		}
		return usage;
	}, [cart]);

	const addToCart = useCallback(
		(dessert: Dessert) => {
			const available = dessert.hasUnlimitedStock
				? Number.POSITIVE_INFINITY
				: (inventoryByDessertId[dessert.id] ?? 0);
			const usedInCart = cartInventoryUsage.get(dessert.id) ?? 0;
			const remaining = available - usedInCart;

			if (remaining <= 0) {
				toast.error("Out of stock — set today's inventory");
				return;
			}

			const existingLine = cart.find(
				(line) =>
					line.baseDessertId === dessert.id && line.modifiers.length === 0,
			);

			if (existingLine) {
				if (existingLine.quantity >= available) {
					toast.error(`Only ${available} left`);
					return;
				}

				setCart((cart) =>
					cart.map((line) =>
						line.cartLineId === existingLine.cartLineId && line.quantity < 199
							? { ...line, quantity: line.quantity + 1 }
							: line,
					),
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
		},
		[cart, cartInventoryUsage, inventoryByDessertId],
	);

	const addComboToCart = useCallback(
		(combo: ComboWithDetails) => {
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

			const existingLine = cart.find((line) => line.comboId === combo.id);

			if (existingLine) {
				if (existingLine.quantity >= available) {
					toast.error(`Only ${available} left`);
					return;
				}

				setCart((cart) =>
					cart.map((line) =>
						line.cartLineId === existingLine.cartLineId && line.quantity < 199
							? { ...line, quantity: line.quantity + 1 }
							: line,
					),
				);
			} else {
				const modifiers = combo.items.map((item) => ({
					dessertId: item.dessert.id,
					name: item.dessert.name,
					price: item.dessert.price,
					quantity: item.quantity,
				}));

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
		},
		[cart, cartInventoryUsage, dessertById, inventoryByDessertId],
	);

	const removeFromCart = useCallback((cartLineId: string) => {
		setCart((cart) => cart.filter((line) => line.cartLineId !== cartLineId));
	}, []);

	const updateQuantity = useCallback(
		(cartLineId: string, quantity: number) => {
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

			const usedByOthers = cart
				.filter(
					(l) =>
						l.baseDessertId === line.baseDessertId &&
						l.cartLineId !== cartLineId,
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
				toast.error("Quantity cannot be greater than 199");
				return;
			}

			setCart((cart) =>
				cart.map((l) => (l.cartLineId === cartLineId ? { ...l, quantity } : l)),
			);
		},
		[cart, dessertById, inventoryByDessertId, removeFromCart],
	);

	const clearCart = useCallback(() => {
		setCart([]);
		form.reset();
		setShowCheckout(false);
	}, [form]);

	const handleToggleStock = useCallback(
		async (e: React.MouseEvent, dessert: Dessert) => {
			e.stopPropagation();

			const newOutOfStockState = !dessert.isOutOfStock;
			addStockToggleLoadingId(dessert.id);
			updateDessert(dessert.id, { isOutOfStock: newOutOfStockState });

			try {
				await toggleOutOfStock(dessert.id, newOutOfStockState);
				toast.success(
					`Marked as ${newOutOfStockState ? "out of stock" : "back in stock"}`,
				);
			} catch (error) {
				toast.error("Failed to update stock status");
				console.error("Failed to toggle stock status:", error);
				updateDessert(dessert.id, { isOutOfStock: dessert.isOutOfStock });
			} finally {
				removeStockToggleLoadingId(dessert.id);
			}
		},
		[addStockToggleLoadingId, updateDessert, removeStockToggleLoadingId],
	);

	const deliveryCost = useStore(
		form.store,
		(state) => state.values.deliveryCost,
	);
	const customerName = useStore(form.store, (state) => state.values.name);

	const total = useMemo(() => {
		const itemCost = cart.reduce(
			(sum, line) => sum + line.unitPrice * line.quantity,
			0,
		);
		const dc = Number.parseFloat(deliveryCost || "0");
		return itemCost + dc;
	}, [cart, deliveryCost]);

	return (
		<div className="min-h-[calc(100vh-52px)] flex flex-col md:flex-row md:gap-4 lg:gap-6">
			{/* Main Content - Products */}
			<div className="flex-1 flex flex-col min-w-0">
				{/* Search Header */}
				<motion.div
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					className="sticky top-[52px] z-30 bg-background/80 backdrop-blur-lg md:relative md:top-0 md:bg-transparent md:backdrop-blur-none"
				>
					<div className="px-4 py-3 md:px-0 md:py-4">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
							<input
								type="text"
								placeholder="Search items..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className={cn(
									"w-full h-11 pl-10 pr-10 rounded-xl border-2 bg-background",
									"text-sm placeholder:text-muted-foreground",
									"focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20",
									"transition-all duration-200",
								)}
							/>
							<AnimatePresence>
								{searchQuery && (
									<motion.button
										type="button"
										initial={{ opacity: 0, scale: 0.8 }}
										animate={{ opacity: 1, scale: 1 }}
										exit={{ opacity: 0, scale: 0.8 }}
										onClick={() => setSearchQuery("")}
										className="absolute right-3 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
									>
										<X className="size-3.5" />
									</motion.button>
								)}
							</AnimatePresence>
						</div>
					</div>
				</motion.div>

				{/* Product Grid */}
				<div className="flex-1 px-4 pb-24 md:pb-6 md:px-0">
					<ProductGrid
						desserts={dessertsWithInventory}
						combos={availableCombos}
						onAddToCart={addToCart}
						onAddComboToCart={addComboToCart}
						onToggleStock={handleToggleStock}
						stockToggleLoadingIds={stockToggleLoadingIds}
						searchQuery={searchQuery}
					/>
				</div>
			</div>

			{/* Cart - Mobile Bottom Sheet */}
			<div className="md:hidden">
				<MobileCartSheet
					cart={cart}
					updateQuantity={updateQuantity}
					removeFromCart={removeFromCart}
					form={form}
					total={total}
					onCheckout={() => setShowCheckout(true)}
				/>
			</div>

			{/* Cart - Tablet Sidebar */}
			<div className="hidden md:block md:w-[340px] lg:w-[380px] xl:w-[400px] shrink-0 sticky top-[52px] h-[calc(100vh-52px-24px)] py-4 pr-4">
				<TabletCartSidebar
					cart={cart}
					updateQuantity={updateQuantity}
					removeFromCart={removeFromCart}
					form={form}
					total={total}
					onCheckout={() => setShowCheckout(true)}
				/>
			</div>

			{/* Checkout Sheet */}
			<CheckoutSheet
				isOpen={showCheckout}
				onClose={() => setShowCheckout(false)}
				cart={cart}
				total={total}
				deliveryCost={Number.parseFloat(deliveryCost || "0")}
				customerName={customerName}
				upiAccounts={upiAccountsList}
				onOrderSaved={refreshInventory}
				clearCart={clearCart}
			/>
		</div>
	);
}
