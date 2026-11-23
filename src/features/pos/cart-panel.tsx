"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CartFields, CartFooter, CartLineList } from "@/features/pos/cart-parts";
import type { PosCart } from "@/features/pos/use-pos-cart";
import type { CheckoutUpiAccount } from "@/features/upi/shapes";
import { formatCount, UNIT } from "@/lib/format";

/** The cart as a column beside the grid, always on screen. */
export function CartPanel({ cart, upiAccounts }: { cart: PosCart; upiAccounts: readonly CheckoutUpiAccount[] }) {
	const hasLines = cart.lines.length > 0;
	return (
		<section
			aria-labelledby="pos-inline-cart-title"
			className="surface-card flex h-full flex-col overflow-hidden shadow-xs"
		>
			<div className="flex shrink-0 items-center justify-between gap-2 border-b py-2 pr-2 pl-4">
				<h2 id="pos-inline-cart-title" className="text-[17px] font-bold">
					Cart
					{hasLines && (
						<span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
							{formatCount(cart.itemCount, UNIT.item)}
						</span>
					)}
				</h2>
				{/* The spacer keeps the header the height of the sm button. */}
				{hasLines ? (
					<Button
						variant="ghost"
						size="sm"
						onClick={cart.clear}
						className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
					>
						<Trash2 />
						Clear
					</Button>
				) : (
					<span className="h-11 md:h-8" aria-hidden="true" />
				)}
			</div>

			<div className="grid shrink-0 grid-cols-2 gap-2 border-b px-4 py-3">
				<CartFields cart={cart} density="compact" />
			</div>

			<ScrollArea className="min-h-0 flex-1">
				{hasLines ? (
					<CartLineList cart={cart} density="compact" />
				) : (
					<EmptyState
						variant="block"
						framed={false}
						title="Cart is empty"
						description="Tap an item to add it."
						className="px-6 py-12"
					/>
				)}
			</ScrollArea>

			<CartFooter
				cart={cart}
				upiAccounts={upiAccounts}
				density="compact"
				onSave={() => void cart.save()}
				className="px-4 py-3"
			/>
		</section>
	);
}
