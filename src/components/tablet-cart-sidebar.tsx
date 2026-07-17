"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, ShoppingBag, Trash2 } from "lucide-react";
import { MAX_DELIVERY_COST } from "@/lib/order-limits";
import type { CartLine } from "@/lib/types";
import { CartLinePresenter } from "./cart-line-presenter";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ScrollArea } from "./ui/scroll-area";
import type { SaveCartOrder } from "./use-save-cart-order";

interface TabletCartSidebarProps {
	cart: CartLine[];
	updateQuantity: (cartLineId: string, quantity: number) => void;
	removeFromCart: (cartLineId: string) => void;
	// biome-ignore lint/suspicious/noExplicitAny: TanStack form has complex generics
	form: any;
	total: number;
	clearCart: () => void;
	onSaveOrder: SaveCartOrder;
	isSaving: boolean;
	customerName: string;
	deliveryCost: string;
}

export function TabletCartSidebar({
	cart,
	updateQuantity,
	removeFromCart,
	form,
	total,
	clearCart,
	onSaveOrder,
	isSaving,
	customerName,
	deliveryCost,
}: TabletCartSidebarProps) {
	const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

	const handleSaveOrder = async () => {
		await onSaveOrder({ customerName, deliveryCost });
	};

	return (
		<div className="h-full flex flex-col bg-muted/30 rounded-2xl border-2 overflow-hidden">
			<div className="shrink-0 px-4 py-3 bg-background border-b">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<div className="relative">
							<ShoppingBag className="size-5 text-primary" />
							{itemCount > 0 && (
								<motion.span
									initial={{ scale: 0 }}
									animate={{ scale: 1 }}
									className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full size-4 flex items-center justify-center"
								>
									{itemCount > 99 ? "99" : itemCount}
								</motion.span>
							)}
						</div>
						<h2 className="font-semibold text-sm">Cart</h2>
					</div>
					{cart.length > 0 && (
						<motion.button
							type="button"
							whileTap={{ scale: 0.95 }}
							onClick={clearCart}
							className="text-[10px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
						>
							<Trash2 className="size-3" />
							Clear
						</motion.button>
					)}
				</div>
			</div>

			<div className="shrink-0 px-4 py-3 bg-background/50 border-b">
				<div className="grid grid-cols-2 gap-2">
					<form.Field name="name">
						{/* biome-ignore lint/suspicious/noExplicitAny: TanStack field type */}
						{(field: any) => (
							<div className="space-y-1">
								<Label
									htmlFor={field.name}
									className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide"
								>
									Customer
								</Label>
								<Input
									id={field.name}
									placeholder="Guest"
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									className="h-8 text-sm"
								/>
							</div>
						)}
					</form.Field>

					<form.Field name="deliveryCost">
						{/* biome-ignore lint/suspicious/noExplicitAny: TanStack field type */}
						{(field: any) => (
							<div className="space-y-1">
								<Label
									htmlFor={field.name}
									className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide"
								>
									Delivery ₹
								</Label>
								<Input
									id={field.name}
									placeholder="0"
									type="number"
									step="0.01"
									min="0"
									max={MAX_DELIVERY_COST}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									className="h-8 text-sm"
								/>
							</div>
						)}
					</form.Field>
				</div>
			</div>

			<ScrollArea className="flex-1">
				<div className="p-3 space-y-2">
					<AnimatePresence mode="popLayout">
						{cart.length === 0 ? (
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								className="flex flex-col items-center justify-center py-12 text-center"
							>
								<ShoppingBag className="size-10 text-muted-foreground/20 mb-2" />
								<p className="text-sm text-muted-foreground">Cart is empty</p>
								<p className="text-[10px] text-muted-foreground/70 mt-1">Tap items to add</p>
							</motion.div>
						) : (
							cart.map((line) => (
								<CartLinePresenter
									variant="tablet"
									key={line.cartLineId}
									line={line}
									updateQuantity={updateQuantity}
									removeFromCart={removeFromCart}
								/>
							))
						)}
					</AnimatePresence>
				</div>
			</ScrollArea>

			<div className="shrink-0 p-3 bg-background border-t space-y-3">
				<div className="flex items-center justify-between px-1">
					<span className="text-sm text-muted-foreground">Total</span>
					<motion.span
						key={total}
						initial={{ scale: 1.1 }}
						animate={{ scale: 1 }}
						className="text-xl font-bold text-primary"
					>
						₹{total.toFixed(0)}
					</motion.span>
				</div>

				{cart.length > 0 && (
					<p className="text-center text-[11px] text-muted-foreground">
						Save the order to generate its final receipt and UPI QR.
					</p>
				)}

				<Button
					onClick={handleSaveOrder}
					disabled={cart.length === 0 || isSaving}
					className="w-full h-11 text-sm font-semibold rounded-xl"
				>
					{isSaving ? (
						<Loader2 className="size-4 animate-spin" />
					) : cart.length === 0 ? (
						"Add items to save"
					) : (
						`Save Order · ₹${total.toFixed(0)}`
					)}
				</Button>
			</div>
		</div>
	);
}
