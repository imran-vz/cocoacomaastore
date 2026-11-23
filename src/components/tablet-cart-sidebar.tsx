"use client";

import { Trash2 } from "lucide-react";
import { AnimatePresence } from "motion/react";
import type { UpiAccount } from "@/db/schema";
import { formatCount } from "@/lib/format";
import { MAX_DELIVERY_COST } from "@/lib/order-limits";
import type { CartLine } from "@/lib/types";
import { CartCopyActions } from "./cart-copy-actions";
import { CartLinePresenter } from "./cart-line-presenter";
import { Button } from "./ui/button";
import { EmptyState } from "./ui/empty-state";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import type { ReactiveButtonComponent } from "./ui/reactive-button";
import { ScrollArea } from "./ui/scroll-area";
import type { SaveCartOrder } from "./use-save-cart-order";

interface TabletCartSidebarProps {
	cart: CartLine[];
	updateQuantity: (cartLineId: string, quantity: number) => void;
	removeFromCart: (cartLineId: string) => void;
	// biome-ignore lint/suspicious/noExplicitAny: TanStack form has complex generics
	form: any;
	total: number;
	upiAccounts: UpiAccount[];
	clearCart: () => void;
	onSaveOrder: SaveCartOrder;
	SaveButton: ReactiveButtonComponent;
	customerName: string;
	deliveryCost: string;
}

export function TabletCartSidebar({
	cart,
	updateQuantity,
	removeFromCart,
	form,
	total,
	upiAccounts,
	clearCart,
	onSaveOrder,
	SaveButton,
	customerName,
	deliveryCost,
}: TabletCartSidebarProps) {
	const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

	const handleSaveOrder = async () => {
		await onSaveOrder({ customerName, deliveryCost });
	};

	return (
		<section
			aria-labelledby="pos-inline-cart-title"
			className="flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-xs"
		>
			<div className="flex shrink-0 items-center justify-between gap-2 border-b py-2 pr-2 pl-4">
				<h2 id="pos-inline-cart-title" className="text-[17px] font-bold">
					Cart
					{itemCount > 0 && (
						<span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
							{formatCount(itemCount, "items")}
						</span>
					)}
				</h2>
				{cart.length > 0 ? (
					<Button
						variant="ghost"
						size="sm"
						onClick={clearCart}
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
				<form.Field name="name">
					{/* biome-ignore lint/suspicious/noExplicitAny: TanStack field type */}
					{(field: any) => (
						<div className="space-y-1">
							<Label htmlFor={field.name} className="text-[13px] text-muted-foreground">
								Customer
							</Label>
							<Input
								id={field.name}
								placeholder="Walk-in"
								autoComplete="off"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								onBlur={field.handleBlur}
							/>
						</div>
					)}
				</form.Field>

				<form.Field name="deliveryCost">
					{/* biome-ignore lint/suspicious/noExplicitAny: TanStack field type */}
					{(field: any) => (
						<div className="space-y-1">
							<Label htmlFor={field.name} className="text-[13px] text-muted-foreground">
								Delivery fee
							</Label>
							<Input
								id={field.name}
								placeholder="0"
								type="number"
								inputMode="decimal"
								step="0.01"
								min="0"
								max={MAX_DELIVERY_COST}
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								onBlur={field.handleBlur}
							/>
						</div>
					)}
				</form.Field>
			</div>

			<ScrollArea className="min-h-0 flex-1">
				{cart.length === 0 ? (
					<EmptyState
						variant="block"
						framed={false}
						title="Cart is empty"
						description="Tap an item to add it."
						className="px-6 py-12"
					/>
				) : (
					<ul aria-label="Cart items" className="divide-y">
						<AnimatePresence mode="popLayout" initial={false}>
							{cart.map((line) => (
								<CartLinePresenter
									variant="tablet"
									key={line.cartLineId}
									line={line}
									updateQuantity={updateQuantity}
									removeFromCart={removeFromCart}
								/>
							))}
						</AnimatePresence>
					</ul>
				)}
			</ScrollArea>

			<div className="shrink-0 space-y-3 border-t px-4 py-3">
				{cart.length > 0 && (
					<CartCopyActions cart={cart} total={total} deliveryCost={deliveryCost} upiAccounts={upiAccounts} compact />
				)}

				<SaveButton onClick={handleSaveOrder} disabled={cart.length === 0} size="lg" className="w-full rounded-xl" />
			</div>
		</section>
	);
}
