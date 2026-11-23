"use client";

import { type RefObject, use, useLayoutEffect, useRef, useState } from "react";
import { SearchField } from "@/components/ui/search-field";
import { useIsMobile } from "@/components/ui/use-mobile";
import type { ComboWithDetails, Dessert } from "@/features/catalog/queries";
import { isComboOnSale } from "@/features/catalog/rules";
import type { DayInventory } from "@/features/inventory/shapes";
import { useTodayInventory } from "@/features/inventory/use-today-inventory";
import { CartPanel } from "@/features/pos/cart-panel";
import { CartSheet } from "@/features/pos/cart-sheet";
import {
	INLINE_CART_COLUMN_CLASS,
	INLINE_CART_MIN_PANE,
	POS_GRID_ROW_CLASS,
	POS_ROOT_CLASS,
	POS_SEARCH_ROW_CLASS,
} from "@/features/pos/layout";
import { ProductGrid } from "@/features/pos/product-grid";
import { usePosCart } from "@/features/pos/use-pos-cart";
import type { CheckoutUpiAccount } from "@/features/upi/shapes";
import type { ServerSnapshot } from "@/lib/server-snapshot";
import { cn } from "@/lib/utils";

type PaneFrame = { left: number; width: number };

/** Measures the POS pane: the cart is inline when the pane is wide enough, else a bar and sheet aligned to it. */
function usePosCartLayout(rootRef: RefObject<HTMLDivElement | null>, isMobile: boolean) {
	const [pane, setPane] = useState<{ contentWidth: number; frame: PaneFrame } | null>(null);

	useLayoutEffect(() => {
		const element = rootRef.current;
		if (!element) return;
		const measure = () => {
			const rect = element.getBoundingClientRect();
			const style = window.getComputedStyle(element);
			const contentWidth =
				rect.width - Number.parseFloat(style.paddingLeft || "0") - Number.parseFloat(style.paddingRight || "0");
			const next = { contentWidth, frame: { left: Math.round(rect.left), width: Math.round(rect.width) } };
			setPane((current) =>
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
		// A window resize can move the pane without resizing it (the centred manager column), which ResizeObserver
		// does not report.
		window.addEventListener("resize", measure);
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", measure);
		};
	}, [rootRef]);

	if (!pane) return null;
	return !isMobile && pane.contentWidth >= INLINE_CART_MIN_PANE
		? ({ mode: "inline" } as const)
		: ({ mode: "sheet", frame: pane.frame } as const);
}

export function PosHome({
	desserts,
	upiAccounts,
	inventory,
	combos,
}: {
	desserts: Promise<Dessert[]>;
	upiAccounts: Promise<readonly CheckoutUpiAccount[]>;
	inventory: Promise<ServerSnapshot<DayInventory>>;
	combos: Promise<ComboWithDetails[]>;
}) {
	const rootRef = useRef<HTMLDivElement>(null);
	const cartLayout = usePosCartLayout(rootRef, useIsMobile());
	const allDesserts = use(desserts);
	const paymentAccounts = use(upiAccounts);
	const allCombos = use(combos);
	const { quantityByDessertId: stock } = useTodayInventory(use(inventory));
	const cart = usePosCart(stock);
	const [searchQuery, setSearchQuery] = useState("");

	const baseDesserts = allDesserts.filter((dessert) => dessert.kind === "base");
	const dessertById = new Map(allDesserts.map((dessert) => [dessert.id, dessert]));
	const combosOnSale = allCombos.filter((combo) =>
		isComboOnSale(
			combo,
			dessertById.get(combo.baseDessertId),
			combo.items.map((item) => dessertById.get(item.dessertId)),
		),
	);

	return (
		<div ref={rootRef} className={POS_ROOT_CLASS}>
			<div className="flex min-w-0 flex-1 flex-col">
				<div className={cn("sticky top-(--app-bar-height) z-20 bg-background", POS_SEARCH_ROW_CLASS)}>
					<SearchField data-pos-search label="Search items" value={searchQuery} onChange={setSearchQuery} />
				</div>

				<div
					className={cn(
						POS_GRID_ROW_CLASS,
						// Room for the floating cart bar so the last tiles stay reachable.
						cartLayout?.mode === "sheet" && cart.lines.length > 0 ? "pb-24" : "pb-6",
					)}
				>
					<ProductGrid
						desserts={baseDesserts}
						combos={combosOnSale}
						stock={stock}
						cart={cart}
						searchQuery={searchQuery}
					/>
				</div>
			</div>

			<p aria-live="polite" className="sr-only">
				{cart.rejection?.message}
			</p>

			{cartLayout?.mode === "sheet" ? (
				<CartSheet cart={cart} upiAccounts={paymentAccounts} frame={cartLayout.frame} />
			) : cartLayout?.mode === "inline" ? (
				<div className={INLINE_CART_COLUMN_CLASS}>
					<CartPanel cart={cart} upiAccounts={paymentAccounts} />
				</div>
			) : null}
		</div>
	);
}
