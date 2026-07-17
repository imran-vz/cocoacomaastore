"use client";

import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { use, useCallback, useEffect, useMemo, useReducer } from "react";
import { toast } from "sonner";

import { toggleOutOfStock } from "@/app/desserts/actions";
import type { UpiAccount } from "@/db/schema";
import { applyPosCartEvent, initialPosCartState } from "@/lib/pos-cart-behaviour";
import type { ComboWithDetails, Dessert } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDessertStore } from "@/store/dessert-store";
import { cartFormSchema } from "./form-schema/cart";
import { MobileCartSheet } from "./mobile-cart-sheet";
import { ProductGrid } from "./product-grid";
import { TabletCartSidebar } from "./tablet-cart-sidebar";
import { useSaveCartOrder } from "./use-save-cart-order";

type InventoryRow = {
	dessertId: number;
	quantity: number;
};

async function fetchTodayInventory(signal?: AbortSignal): Promise<InventoryRow[]> {
	const response = await fetch("/api/manager/inventory/today", {
		cache: "no-store",
		signal,
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch inventory (${response.status})`);
	}

	return response.json();
}

interface POSHomeProps {
	desserts: Promise<Dessert[]>;
	upiAccounts: Promise<UpiAccount[]>;
	inventory: Promise<InventoryRow[]>;
	combos: Promise<ComboWithDetails[]>;
	variant?: "manager" | "admin";
}

export default function POSHome({ desserts, upiAccounts, inventory, combos, variant = "manager" }: POSHomeProps) {
	const items = use(desserts);
	const upiAccountsList = use(upiAccounts);
	const initialInventory = use(inventory);
	const combosList = use(combos);
	const searchStickyTopClass = variant === "admin" ? "top-16" : "top-13";
	const {
		data: inventoryRows,
		error: inventoryError,
		refetch: refetchInventory,
	} = useQuery({
		queryKey: ["inventory", "today"],
		queryFn: ({ signal }) => fetchTodayInventory(signal),
		initialData: initialInventory,
		staleTime: 30_000,
		gcTime: 5 * 60_000,
	});

	const [cartState, dispatchCart] = useReducer(applyPosCartEvent, initialPosCartState);
	const cart = cartState.cart;
	const inventoryByDessertId = useMemo(() => {
		const next: Record<number, number> = {};
		for (const row of inventoryRows) {
			next[row.dessertId] = row.quantity;
		}
		return next;
	}, [inventoryRows]);

	if (inventoryError) {
		console.error("Failed to fetch inventory:", inventoryError);
	}

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

	useEffect(() => {
		setLocalDesserts(items);
	}, [items, setLocalDesserts]);

	const availableCombos = useMemo(
		() =>
			combosList.filter((combo) =>
				localDesserts.some((dessert) => dessert.id === combo.baseDessertId && !dessert.isOutOfStock),
			),
		[combosList, localDesserts],
	);

	const form = useForm({
		defaultValues: { name: "", deliveryCost: "" },
		validators: { onChange: cartFormSchema },
	});

	const dessertsWithInventory = useMemo(
		() =>
			localDesserts
				.filter((dessert) => dessert.kind === "base")
				.map((dessert) => ({
					...dessert,
					inventoryQuantity: dessert.hasUnlimitedStock ? undefined : (inventoryByDessertId[dessert.id] ?? 0),
				})),
		[localDesserts, inventoryByDessertId],
	);

	const refreshInventory = useCallback(async () => {
		await refetchInventory();
	}, [refetchInventory]);

	useEffect(() => {
		if (cartState.lastError) toast.error(cartState.lastError.message);
	}, [cartState.lastError]);

	const addToCart = useCallback(
		(dessert: Dessert) => {
			dispatchCart({ type: "add-dessert", dessert, inventoryByDessertId });
		},
		[inventoryByDessertId],
	);

	const addCombo = useCallback(
		(combo: ComboWithDetails) => {
			dispatchCart({ type: "add-combo", combo, inventoryByDessertId });
		},
		[inventoryByDessertId],
	);

	const removeFromCart = useCallback((cartLineId: string) => {
		dispatchCart({ type: "remove-line", cartLineId });
	}, []);

	const updateQuantity = useCallback(
		(cartLineId: string, quantity: number) => {
			dispatchCart({ type: "update-quantity", cartLineId, quantity, inventoryByDessertId });
		},
		[inventoryByDessertId],
	);

	const clearCart = useCallback(() => {
		dispatchCart({ type: "clear" });
		form.reset();
	}, [form]);

	const { isSaving, saveOrder } = useSaveCartOrder({ cart, clearCart, refreshInventory });

	const handleToggleStock = useCallback(
		async (e: React.MouseEvent, dessert: Dessert) => {
			e.stopPropagation();

			const nextIsOutOfStock = !dessert.isOutOfStock;
			addStockToggleLoadingId(dessert.id);
			updateDessert(dessert.id, { isOutOfStock: nextIsOutOfStock });

			try {
				await toggleOutOfStock(dessert.id, nextIsOutOfStock);
				toast.success(`Marked as ${nextIsOutOfStock ? "out of stock" : "back in stock"}`);
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

	return (
		<form.Subscribe selector={(state) => state.values}>
			{({ deliveryCost, name: customerName }) => {
				const deliveryCostAmount = Number.parseFloat(deliveryCost || "0");
				const total = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, deliveryCostAmount);

				return (
					<div className="min-h-app flex flex-col md:flex-row md:gap-4 lg:gap-6">
						{/* Main Content - Products */}
						<div className="flex-1 flex flex-col min-w-0">
							{/* Search Header */}
							<motion.div
								initial={{ opacity: 0, y: -10 }}
								animate={{ opacity: 1, y: 0 }}
								className={cn("sticky z-50 md:relative md:top-0 mb-1", searchStickyTopClass)}
							>
								<div className="px-4 py-2 md:px-0 md:py-4">
									<div className="relative">
										<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
										<input
											type="text"
											placeholder="Search items..."
											value={searchQuery}
											onChange={(e) => setSearchQuery(e.target.value)}
											className={cn(
												"w-full h-10 md:h-11 pl-10 pr-10 rounded-xl border-2 bg-background",
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
									onAddComboToCart={addCombo}
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
								upiAccounts={upiAccountsList}
								customerName={customerName}
								onSaveOrder={saveOrder}
								isSaving={isSaving}
							/>
						</div>

						{/* Cart - Tablet Sidebar */}
						<div className="hidden md:block md:w-85 lg:w-95 xl:w-100 shrink-0 sticky top-13 h-[calc(100vh-52px-24px)] py-4 pr-4">
							<TabletCartSidebar
								cart={cart}
								updateQuantity={updateQuantity}
								removeFromCart={removeFromCart}
								form={form}
								total={total}
								upiAccounts={upiAccountsList}
								clearCart={clearCart}
								onSaveOrder={saveOrder}
								isSaving={isSaving}
								customerName={customerName}
								deliveryCost={deliveryCostAmount}
							/>
						</div>
					</div>
				);
			}}
		</form.Subscribe>
	);
}
