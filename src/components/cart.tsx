"use client";

import { AnimatePresence } from "framer-motion";

import type { CartItem } from "@/lib/types";
import { QuantityControls } from "./cart-quantity-controls";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface CartProps {
	cart: CartItem[];
	updateQuantity: (dessertId: number, quantity: number) => void;
	removeFromCart: (dessertId: number) => void;
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
		<div className="flex flex-col">
			<form className="space-y-3">
				<div className="space-y-3">
					<form.Field name="name">
						{/* biome-ignore lint/suspicious/noExplicitAny: TanStack field type */}
						{(field: any) => (
							<div className="space-y-2">
								<Label
									htmlFor={field.name}
									className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
								>
									Customer Name
								</Label>
								<Input
									id={field.name}
									placeholder="Enter name"
									value={field.state.value}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
										field.handleChange(e.target.value)
									}
									onBlur={field.handleBlur}
									className="h-10 rounded-lg border-neutral-200 focus:ring-2 focus:ring-offset-0 placeholder:text-neutral-400 text-sm"
								/>
							</div>
						)}
					</form.Field>

					<form.Field name="deliveryCost">
						{/* biome-ignore lint/suspicious/noExplicitAny: TanStack field type */}
						{(field: any) => (
							<div className="space-y-2">
								<Label
									htmlFor={field.name}
									className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
								>
									Delivery Cost (₹)
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
									className="h-10 rounded-lg border-neutral-200 focus:ring-2 focus:ring-offset-0 placeholder:text-neutral-400 text-sm"
								/>
							</div>
						)}
					</form.Field>
				</div>

				<div className="max-h-72 overflow-y-auto overflow-x-hidden">
					<AnimatePresence mode="popLayout">
						{cart.map((item) => (
							<QuantityControls
								key={item.id}
								item={item}
								updateQuantity={updateQuantity}
								removeFromCart={removeFromCart}
							/>
						))}
					</AnimatePresence>
				</div>
			</form>
		</div>
	);
}
