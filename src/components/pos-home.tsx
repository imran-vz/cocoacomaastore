"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import {
	type RefObject,
	use,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "react";
import { toggleOutOfStock } from "@/app/desserts/actions";
import type { UpiAccount } from "@/db/schema";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { Button } from "./ui/button";
import { Input } from "./ui/input";
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

/**
 * Inline cart vs. cart bar + sheet is chosen from the POS pane's own width (decision 13),
 * not the viewport: at 820px with the admin sidebar open the pane is ~520px wide and a
 * side cart would crush the grid. The inline cart needs a ≥ 340px catalog + 16px gap +
 * the 300px cart, and is never used on phones (< md), where the tab bar owns the bottom.
 */
const INLINE_CART_MIN_PANE = 340 + 16 + 300;

type CartMode = "sheet" | "inline";
type PaneFrame = { left: number; width: number };

function usePosCartLayout(rootRef: RefObject<HTMLDivElement | null>, isMobile: boolean) {
	const [state, setState] = useState<{ contentWidth: number; frame: PaneFrame } | null>(null);

	useLayoutEffect(() => {
		const element = rootRef.current;
		if (!element) return;
		const measure = () => {
			const rect = element.getBoundingClientRect();
			const style = window.getComputedStyle(element);
			const contentWidth =
				rect.width - Number.parseFloat(style.paddingLeft || "0") - Number.parseFloat(style.paddingRight || "0");
			const next = { contentWidth, frame: { left: Math.round(rect.left), width: Math.round(rect.width) } };
			setState((current) =>
				current &&
				Math.round(current.contentWidth) === Math.round(next.contentWidth) &&
				current.frame.left === next.frame.left &&
				current.frame.width === next.frame.width
					? current
					: next,
			);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		window.addEventListener("resize", measure);
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", measure);
		};
	}, [rootRef]);

	const cartMode: CartMode | null = state
		? !isMobile && state.contentWidth >= INLINE_CART_MIN_PANE
			? "inline"
			: "sheet"
		: null;

	return { cartMode, paneFrame: state?.frame ?? null };
}

interface POSHomeProps {
	desserts: Promise<Dessert[]>;
	upiAccounts: Promise<UpiAccount[]>;
	inventory: Promise<InventoryRow[]>;
	combos: Promise<ComboWithDetails[]>;
}

export default function POSHome({ desserts, upiAccounts, inventory, combos }: POSHomeProps) {
	const isMobile = useIsMobile();
	const rootRef = useRef<HTMLDivElement>(null);
	const { cartMode, paneFrame } = usePosCartLayout(rootRef, isMobile);
	const items = use(desserts);
	const upiAccountsList = use(upiAccounts);
	const initialInventory = use(inventory);
	const combosList = use(combos);
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
	const cartQuantities = useMemo(() => {
		const desserts = new Map<number, number>();
		const combos = new Map<number, number>();
		for (const line of cart) {
			if (line.comboId !== undefined) combos.set(line.comboId, (combos.get(line.comboId) ?? 0) + line.quantity);
			else if (line.modifiers.length === 0)
				desserts.set(line.baseDessertId, (desserts.get(line.baseDessertId) ?? 0) + line.quantity);
		}
		return { desserts, combos };
	}, [cart]);
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
		<div
			ref={rootRef}
			// Gutters: 16px on phones (on the search and grid rows), 24px from md.
			className="@container/pos min-h-app flex flex-col md:flex-row md:gap-4 md:px-6"
		>
			<div className="flex min-w-0 flex-1 flex-col">
				<div className="sticky top-(--app-bar-height) z-20 bg-background px-4 pt-3 pb-2 md:px-0 md:pt-6 md:pb-3">
					<div className="relative">
						<Search
							aria-hidden="true"
							className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground md:size-4"
						/>
						<Input
							type="search"
							data-pos-search
							aria-label="Search items"
							placeholder="Search items"
							enterKeyHint="search"
							autoComplete="off"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="rounded-xl pr-11 pl-10 [&::-webkit-search-cancel-button]:hidden"
						/>
						{searchQuery && (
							<Button
								variant="ghost"
								size="icon-touch"
								aria-label="Clear search"
								onClick={() => setSearchQuery("")}
								className="absolute top-1/2 right-0 -translate-y-1/2 rounded-xl text-muted-foreground md:size-9"
							>
								<X />
							</Button>
						)}
					</div>
				</div>

				<div
					className={cn(
						"flex-1 px-4 pt-1 md:px-0",
						// Room for the floating cart bar so the last tiles stay reachable.
						cartMode === "sheet" && cart.length > 0 ? "pb-24" : "pb-6",
					)}
				>
					<ProductGrid
						desserts={dessertsWithInventory}
						combos={availableCombos}
						dessertQuantities={cartQuantities.desserts}
						comboQuantities={cartQuantities.combos}
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

			<form.Subscribe selector={(state) => state.values}>
				{({ deliveryCost, name: customerName }) =>
					cartMode === "sheet" ? (
						<MobileCartSheet
							cart={cart}
							updateQuantity={updateWithCartInteraction}
							removeFromCart={removeWithCartInteraction}
							form={form}
							total={saveOrderTotal}
							upiAccounts={upiAccountsList}
							customerName={customerName}
							deliveryCost={deliveryCost}
							onSaveOrder={saveOrder}
							saveControls={saveControls}
							SaveButton={SaveButton}
							frame={paneFrame ?? undefined}
						/>
					) : cartMode === "inline" ? (
						<div className="sticky top-[calc(var(--app-bar-height)+1.5rem)] mb-6 h-[calc(100svh-var(--app-bar-height)-3rem)] w-75 shrink-0 self-start @4xl/pos:w-85 @6xl/pos:w-95">
							<TabletCartSidebar
								cart={cart}
								updateQuantity={updateWithCartInteraction}
								removeFromCart={removeWithCartInteraction}
								form={form}
								total={saveOrderTotal}
								upiAccounts={upiAccountsList}
								clearCart={clearWithCartInteraction}
								onSaveOrder={saveOrder}
								SaveButton={SaveButton}
								customerName={customerName}
								deliveryCost={deliveryCost}
							/>
						</div>
					) : null
				}
			</form.Subscribe>
		</div>
	);
}
