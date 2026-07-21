"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { use, useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { toggleOutOfStock } from "@/app/desserts/actions";
import type { UpiAccount } from "@/db/schema";
import {
	addComboToCart,
	addDessertToCart,
	applyPosCartEvent,
	initialPosCartState,
	reconcileSubmittedOrderFields,
	type SubmittedOrderSnapshot,
} from "@/lib/pos-cart-behaviour";
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
	const [pinnedStockState, setPinnedStockState] = useState<Map<number, boolean>>(new Map());

	useEffect(() => {
		setLocalDesserts(items);
	}, [items, setLocalDesserts]);

	const availableCombos = useMemo(() => {
		const dessertById = new Map(localDesserts.map((dessert) => [dessert.id, dessert]));
		const isAvailable = (dessertId: number) => {
			const dessert = dessertById.get(dessertId);
			return Boolean(
				dessert?.enabled && !dessert.isDeleted && !dessert.isOutOfStock && !stockToggleLoadingIds.has(dessertId),
			);
		};

		return combosList.filter(
			(combo) =>
				combo.enabled &&
				!combo.isDeleted &&
				isAvailable(combo.baseDessertId) &&
				combo.items.every((item) => isAvailable(item.dessertId)),
		);
	}, [combosList, localDesserts, stockToggleLoadingIds]);

	const form = useForm({
		defaultValues: { name: "", deliveryCost: "" },
		validators: { onChange: cartFormSchema },
	});

	// Reactive delivery cost so the save button's total label stays live as it is typed.
	const deliveryCostValue = useStore(form.store, (state) => state.values.deliveryCost);
	const saveOrderTotal = useMemo(
		() => cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, Number.parseFloat(deliveryCostValue || "0")),
		[cart, deliveryCostValue],
	);

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

	const addToCart = useCallback(
		(dessert: Dessert) => {
			const result = addDessertToCart(cart, dessert, inventoryByDessertId);
			dispatchCart({ type: "add-dessert", dessert, inventoryByDessertId });
			return result.ok;
		},
		[cart, inventoryByDessertId],
	);

	const addCombo = useCallback(
		(combo: ComboWithDetails) => {
			const result = addComboToCart(cart, combo, inventoryByDessertId);
			dispatchCart({ type: "add-combo", combo, inventoryByDessertId });
			return result.ok;
		},
		[cart, inventoryByDessertId],
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

	const acknowledgeSubmittedOrder = useCallback(
		(snapshot: SubmittedOrderSnapshot) => {
			dispatchCart({ type: "acknowledge-submission", submittedCart: snapshot.cart });
			const current = {
				customerName: form.state.values.name,
				deliveryCost: form.state.values.deliveryCost,
			};
			const reconciled = reconcileSubmittedOrderFields(current, snapshot);
			if (reconciled.customerName !== current.customerName) form.setFieldValue("name", reconciled.customerName);
			if (reconciled.deliveryCost !== current.deliveryCost) {
				form.setFieldValue("deliveryCost", reconciled.deliveryCost);
			}
		},
		[form],
	);

	const clearCart = useCallback(() => {
		dispatchCart({ type: "clear" });
		form.reset();
	}, [form]);

	const { saveControls, SaveButton, saveOrder, registerCartInteraction } = useSaveCartOrder({
		cart,
		total: saveOrderTotal,
		intentVersion: cartState.intentVersion,
		acknowledgeSubmittedOrder,
		refreshInventory,
	});

	const addToCartWithCartInteraction = useCallback(
		(dessert: Dessert) => {
			registerCartInteraction();
			return addToCart(dessert);
		},
		[addToCart, registerCartInteraction],
	);
	const addComboWithCartInteraction = useCallback(
		(combo: ComboWithDetails) => {
			registerCartInteraction();
			return addCombo(combo);
		},
		[addCombo, registerCartInteraction],
	);
	const removeWithCartInteraction = useCallback(
		(cartLineId: string) => {
			registerCartInteraction();
			removeFromCart(cartLineId);
		},
		[registerCartInteraction, removeFromCart],
	);
	const updateWithCartInteraction = useCallback(
		(cartLineId: string, quantity: number) => {
			registerCartInteraction();
			updateQuantity(cartLineId, quantity);
		},
		[registerCartInteraction, updateQuantity],
	);
	const clearWithCartInteraction = useCallback(() => {
		registerCartInteraction();
		clearCart();
	}, [registerCartInteraction, clearCart]);

	// Runs the optimistic stock toggle and server call. Resolves with the announcement
	// message so the per-card button can flash success; throws (after rollback) on failure.
	// The pin is held until the card's success flash completes (see clearPinnedStock).
	const toggleStock = useCallback(
		async (dessert: Dessert): Promise<string> => {
			const nextIsOutOfStock = !dessert.isOutOfStock;
			setPinnedStockState((current) => new Map(current).set(dessert.id, dessert.isOutOfStock));
			addStockToggleLoadingId(dessert.id);
			updateDessert(dessert.id, { isOutOfStock: nextIsOutOfStock });

			try {
				await toggleOutOfStock(dessert.id, nextIsOutOfStock);
				removeStockToggleLoadingId(dessert.id);
				return `${dessert.name} marked ${nextIsOutOfStock ? "out of stock" : "available"}`;
			} catch (error) {
				console.error("Failed to toggle stock status:", error);
				updateDessert(dessert.id, { isOutOfStock: dessert.isOutOfStock });
				setPinnedStockState((current) => {
					const next = new Map(current);
					next.delete(dessert.id);
					return next;
				});
				removeStockToggleLoadingId(dessert.id);
				throw error;
			}
		},
		[addStockToggleLoadingId, removeStockToggleLoadingId, updateDessert],
	);

	const clearPinnedStock = useCallback((dessertId: number) => {
		setPinnedStockState((current) => {
			if (!current.has(dessertId)) return current;
			const next = new Map(current);
			next.delete(dessertId);
			return next;
		});
	}, []);

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
												"transition-[border-color,box-shadow] duration-200",
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
									onAddToCart={addToCartWithCartInteraction}
									onAddComboToCart={addComboWithCartInteraction}
									onToggleStock={toggleStock}
									onToggleStockComplete={clearPinnedStock}
									stockToggleLoadingIds={stockToggleLoadingIds}
									pinnedStockState={pinnedStockState}
									searchQuery={searchQuery}
								/>
							</div>
						</div>

						{/* Cart - Mobile Bottom Sheet */}
						<div className="md:hidden">
							<MobileCartSheet
								cart={cart}
								updateQuantity={updateWithCartInteraction}
								removeFromCart={removeWithCartInteraction}
								form={form}
								total={total}
								upiAccounts={upiAccountsList}
								customerName={customerName}
								deliveryCost={deliveryCost}
								onSaveOrder={saveOrder}
								saveControls={saveControls}
								SaveButton={SaveButton}
							/>
						</div>

						{/* Cart - Tablet Sidebar */}
						<div className="hidden md:block md:w-85 lg:w-95 xl:w-100 shrink-0 sticky top-13 h-[calc(100vh-52px-24px)] py-4 pr-4">
							<TabletCartSidebar
								cart={cart}
								updateQuantity={updateWithCartInteraction}
								removeFromCart={removeWithCartInteraction}
								form={form}
								total={total}
								upiAccounts={upiAccountsList}
								clearCart={clearWithCartInteraction}
								onSaveOrder={saveOrder}
								SaveButton={SaveButton}
								customerName={customerName}
								deliveryCost={deliveryCost}
							/>
						</div>
					</div>
				);
			}}
		</form.Subscribe>
	);
}
