"use client";

import { AnimatePresence } from "framer-motion";

import type { CartLine } from "@/lib/types";
import { CartLineControls } from "./cart-quantity-controls";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface CartProps {
	cart: CartLine[];
	updateQuantity: (cartLineId: string, quantity: number) => void;
	removeFromCart: (cartLineId: string) => void;
	// biome-ignore lint/suspicious/noExplicitAny: TanStack form has complex generics
	form: any;
}

export function Cart({
	cart,
	updateQuantity,
	removeFromCart,
	form,
}: CartProps) {
	return (
		<div className="flex flex-col h-full">
			<form className="space-y-4 flex flex-col h-full">
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<form.Field name="name">
						{/* biome-ignore lint/suspicious/noExplicitAny: TanStack field type */}
						{(field: any) => (
							<div className="space-y-1.5">
								<Label
									htmlFor={field.name}
									className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
								>
									Customer
								</Label>
								<Input
									id={field.name}
									placeholder="Guest"
									value={field.state.value}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
										field.handleChange(e.target.value)
									}
									onBlur={field.handleBlur}
									className="h-9"
								/>
							</div>
						)}
					</form.Field>

					<form.Field name="deliveryCost">
						{/* biome-ignore lint/suspicious/noExplicitAny: TanStack field type */}
						{(field: any) => (
							<div className="space-y-1.5">
								<Label
									htmlFor={field.name}
									className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
								>
									Delivery (₹)
								</Label>
								<Input
									id={field.name}
									placeholder="0"
									type="number"
									step="0.01"
									min="0"
									value={field.state.value}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
										field.handleChange(e.target.value)
									}
									onBlur={field.handleBlur}
									className="h-9"
								/>
							</div>
						)}
					</form.Field>
				</div>

				<div className="flex-1 min-h-[300px] max-h-[60vh] overflow-y-auto overflow-x-hidden rounded-md p-1">
					<AnimatePresence mode="popLayout" initial={false}>
						{cart.length === 0 ? (
							<div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center border-2 border-dashed rounded-lg">
								<p className="text-sm">Cart is empty</p>
								<p className="text-xs mt-1 opacity-70">Add items to start an order</p>
							</div>
						) : (
							<div className="divide-y">
								{cart.map((line) => (
									<CartLineControls
										key={line.cartLineId}
										line={line}
										updateQuantity={updateQuantity}
										removeFromCart={removeFromCart}
									/>
								))}
							</div>
						)}
					</AnimatePresence>
				</div>
			</form>
		</div>
	);
}
